"""OctaneFinder data pipeline — Postgres loader.

Upserts canonical stations (the output of ``normalize.py --keep-internal``) into
the production PostgreSQL + PostGIS schema (final-database.md §6), writing an
append-only ``data_provenance`` row for every acquisition so every served fact
can be traced to its source, licence and retrieval date (memo C.1/C.6).

Target tables (already created by the DB builder's migrations):
``brands``, ``states``, ``cities``, ``fuel_types``, ``sources``, ``stations``,
``station_fuels``, ``data_provenance``.

Design:

* **Idempotent core.** Reference rows upsert by their natural keys; stations
  upsert by ``(brand_id, brand_ro_code)`` (the OMC dedup key); station_fuels by
  their composite PK. Re-running does not duplicate stations.
* **Append-only provenance.** ``data_provenance`` accumulates one row per record
  per run by design (re-captures build history) — pass ``--no-provenance`` to
  skip when re-loading for tests.
* **Graceful when the DB is absent.** No ``DATABASE_URL`` -> a clear message and
  a non-zero exit (the CLI analogue of the app's write-time 503). ``--dry-run``
  needs neither a database nor ``psycopg`` installed.
* **DPDP.** ``dealer_legal_name`` is loaded to the INTERNAL-only column; it is
  never part of ``name`` and never served (memo C.17).

Scheduling: run after each normalise (see the cron note in ``pipeline/README.md``).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from typing import Any, Dict, List, Optional

from common import (
    PipelineError,
    get_config,
    get_logger,
    read_json,
    utc_now_iso,
)
from normalize import (
    GRADE_CODE_BY_NAME,
    GRADES,
    SOURCE_REGISTRY,
    state_lookup,
)

# psycopg is optional at import time so this module is import-safe and --dry-run
# works in a bare interpreter. It is required only for an actual load.
try:  # pragma: no cover - trivial import guard
    import psycopg as _psycopg  # type: ignore
except Exception:  # noqa: BLE001
    _psycopg = None

log = get_logger("load")

__all__ = ["DbUnavailable", "Loader", "connect", "main"]


class DbUnavailable(PipelineError):
    """Raised when a database load is requested but no DB/driver is available."""


# canonical GradeName display -> brand code, for brand inference from a grade.
_BRAND_NAME = {"IOCL": "Indian Oil", "HPCL": "Hindustan Petroleum", "BPCL": "Bharat Petroleum"}

# fuel_types seed metadata beyond data/grades.json (ethanol provenance, §6.5).
_FUEL_TYPE_EXTRA: Dict[str, Dict[str, Any]] = {
    "XP100": {"ethanol_source": "E0 per Lok Sabha reply 23-Jul-2026", "max_ethanol_pct": None},
    "POWER100": {"ethanol_source": "E0 per Govt of India (Lok Sabha, 23-Jul-2026)", "max_ethanol_pct": None},
    "SPEED100": {"ethanol_source": "independently tested E0; live API code 'SPEED 100 BS IV'", "max_ethanol_pct": None},
    "POWER99": {"ethanol_source": None, "max_ethanol_pct": None},
    "SPEED97": {"ethanol_source": "E20 (phase-out)", "max_ethanol_pct": 20.0},
}

# canonical availability -> availability_status enum (§6.4).
_AVAILABILITY_ENUM = {"in_stock": "available", "out_of_stock": "out_of_stock", "unknown": "unknown"}

# canonical VerificationStatus -> station_status enum.
_STATION_STATUS = {"official-listed": "unverified", "field-verified": "active", "stale": "active"}

# reverse map: ProvenanceRef.source display string -> registry entry.
_SOURCE_BY_REF = {entry["ref_source"]: entry for entry in SOURCE_REGISTRY.values()}

_PINCODE_OK = re.compile(r"^[1-9][0-9]{5}$")


def connect(database_url: Optional[str]) -> Any:
    """Open a psycopg connection, or raise :class:`DbUnavailable`."""
    if not database_url:
        raise DbUnavailable("DATABASE_URL is not set; cannot load to Postgres")
    if _psycopg is None:
        raise DbUnavailable("psycopg is not installed; `pip install psycopg[binary]`")
    return _psycopg.connect(database_url)


class Loader:
    """Performs the reference/station/fuel/provenance upserts within one txn."""

    def __init__(self, conn: Any, *, record_provenance: bool = True) -> None:
        self.conn = conn
        self.record_provenance = record_provenance
        self._brand_id: Dict[str, int] = {}
        self._state_id: Dict[str, int] = {}
        self._city_id: Dict[str, int] = {}
        self._fuel_id: Dict[str, int] = {}
        self._source_id: Dict[str, int] = {}

    # -- reference upserts -------------------------------------------------- #
    def ensure_reference(self) -> None:
        """Upsert brands, fuel_types and provenance sources (state/city lazily)."""
        for code, name in _BRAND_NAME.items():
            self._brand_id[code] = self._scalar(
                """
                INSERT INTO brands (code, name, is_psu) VALUES (%s, %s, true)
                ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
                """,
                (code, name),
            )
        for grade in GRADES:
            code = grade["code"]
            extra = _FUEL_TYPE_EXTRA.get(code, {})
            self._fuel_id[code] = self._scalar(
                """
                INSERT INTO fuel_types
                    (code, brand_id, display_name, ron, is_premium, is_legacy,
                     ethanol_free, max_ethanol_pct, ethanol_source, is_active)
                VALUES (%s, %s, %s, %s, true, %s, %s, %s, %s, true)
                ON CONFLICT (code) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    is_legacy    = EXCLUDED.is_legacy,
                    ethanol_free = EXCLUDED.ethanol_free,
                    ethanol_source = EXCLUDED.ethanol_source
                RETURNING id
                """,
                (
                    code,
                    self._brand_id[grade["brand"]],
                    grade["full"],
                    grade["ron"],
                    grade["legacy"],
                    grade["e0"],
                    extra.get("max_ethanol_pct"),
                    extra.get("ethanol_source"),
                ),
            )
        for entry in SOURCE_REGISTRY.values():
            slug = entry["slug"]
            if slug in self._source_id:
                continue
            self._source_id[slug] = self._scalar(
                """
                INSERT INTO sources
                    (slug, name, publisher, url, legal_basis, license_name,
                     attribution_text, terms_notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (slug) DO UPDATE SET
                    name = EXCLUDED.name, terms_notes = EXCLUDED.terms_notes
                RETURNING id
                """,
                (
                    slug,
                    entry["name"],
                    entry.get("publisher"),
                    entry.get("url"),
                    entry["legal_basis"],
                    entry.get("license_name"),
                    entry.get("attribution_text"),
                    entry.get("terms_notes"),
                ),
            )

    def _ensure_state(self, state_name: str) -> int:
        resolved = state_lookup(state_name)
        if resolved is None:
            raise PipelineError(f"cannot resolve state {state_name!r}")
        display, _code2, iso, is_ut = resolved
        if iso in self._state_id:
            return self._state_id[iso]
        sid = self._scalar(
            """
            INSERT INTO states (iso_code, name, is_union_territory) VALUES (%s, %s, %s)
            ON CONFLICT (iso_code) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            (iso, display, is_ut),
        )
        self._state_id[iso] = sid
        return sid

    def _ensure_city(self, city_name: str, city_slug: str, state_id: int) -> int:
        if city_slug in self._city_id:
            return self._city_id[city_slug]
        cid = self._scalar(
            """
            INSERT INTO cities (state_id, name, slug) VALUES (%s, %s, %s)
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            (state_id, city_name, city_slug),
        )
        self._city_id[city_slug] = cid
        return cid

    # -- station upserts ---------------------------------------------------- #
    def upsert_station(self, station: Dict[str, Any]) -> Optional[str]:
        """Upsert one canonical station and its fuels. Returns the station uuid."""
        brand = station["brand"]
        brand_id = self._brand_id[brand]
        state_id = self._ensure_state(station["state"])
        city_id = self._ensure_city(station["city"], station["citySlug"], state_id)

        ro_code = station.get("_omcCode") or station["roCode"]
        pincode = station.get("pincode") or ""
        pincode = pincode if _PINCODE_OK.match(pincode) else None
        status = _station_status(station)
        primary_source_id = self._primary_source_id(station)

        station_id = self._scalar(
            """
            INSERT INTO stations
                (brand_id, name, dealer_legal_name, brand_ro_code, address, pincode,
                 city_id, state_id, location, status, phone, primary_source_id,
                 updated_at)
            VALUES
                (%(brand_id)s, %(name)s, %(dealer)s, %(ro)s, %(address)s, %(pincode)s,
                 %(city_id)s, %(state_id)s,
                 ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography,
                 %(status)s, %(phone)s, %(psid)s, now())
            ON CONFLICT (brand_id, brand_ro_code) WHERE brand_ro_code IS NOT NULL
            DO UPDATE SET
                name = EXCLUDED.name,
                dealer_legal_name = EXCLUDED.dealer_legal_name,
                address = EXCLUDED.address,
                pincode = EXCLUDED.pincode,
                city_id = EXCLUDED.city_id,
                state_id = EXCLUDED.state_id,
                location = EXCLUDED.location,
                phone = EXCLUDED.phone,
                updated_at = now()
            RETURNING id
            """,
            {
                "brand_id": brand_id,
                "name": station["name"],
                "dealer": station.get("_dealerLegalName"),
                "ro": ro_code,
                "address": station.get("address") or None,
                "pincode": pincode,
                "city_id": city_id,
                "state_id": state_id,
                "lng": station["lng"],
                "lat": station["lat"],
                "status": status,
                "phone": station.get("phone"),
                "psid": primary_source_id,
            },
        )

        for grade in station.get("grades", []):
            self._upsert_station_fuel(station_id, station, grade)

        if self.record_provenance:
            self._write_provenance(station_id, station)
        return station_id

    def _upsert_station_fuel(self, station_id: str, station: Dict[str, Any], grade: Dict[str, Any]) -> None:
        code = GRADE_CODE_BY_NAME.get(grade["grade"])
        if code is None:
            log.warning("skipping unknown grade %r", grade.get("grade"))
            return
        fuel_type_id = self._fuel_id[code]
        availability = _AVAILABILITY_ENUM.get(grade.get("availability", "unknown"), "unknown")

        price_paise: Optional[int] = None
        price_at: Optional[str] = None
        price = station.get("price")
        if price is not None and price.get("grade") == grade["grade"]:
            try:
                price_paise = int(round(float(price["value"]) * 100))
            except (TypeError, ValueError):
                price_paise = None
            price_at = price.get("asOf")

        self._execute(
            """
            INSERT INTO station_fuels
                (station_id, fuel_type_id, availability, first_listed_at,
                 last_verified_at, last_price_paise, last_price_at, updated_at)
            VALUES (%s, %s, %s, %s, NULL, %s, %s, now())
            ON CONFLICT (station_id, fuel_type_id) DO UPDATE SET
                availability = EXCLUDED.availability,
                last_price_paise = COALESCE(EXCLUDED.last_price_paise, station_fuels.last_price_paise),
                last_price_at = COALESCE(EXCLUDED.last_price_at, station_fuels.last_price_at),
                updated_at = now()
            """,
            (
                station_id,
                fuel_type_id,
                availability,
                station.get("firstSeen") or utc_now_iso(),
                price_paise,
                price_at,
            ),
        )

    def _primary_source_id(self, station: Dict[str, Any]) -> int:
        for ref in station.get("sources", []):
            entry = _SOURCE_BY_REF.get(ref.get("source"))
            if entry is not None:
                return self._source_id[entry["slug"]]
        raise PipelineError(f"station {station.get('id')} has no known provenance source")

    def _write_provenance(self, station_id: str, station: Dict[str, Any]) -> None:
        for ref in station.get("sources", []):
            entry = _SOURCE_BY_REF.get(ref.get("source"))
            if entry is None:
                continue
            source_id = self._source_id[entry["slug"]]
            method = entry["provenance_method"]
            retrieved_at = ref.get("retrievedAt") or utc_now_iso()
            # station-level provenance
            self._execute(
                """
                INSERT INTO data_provenance
                    (source_id, entity, entity_pk, retrieved_at, method, notes)
                VALUES (%s, 'station', %s, %s, %s, %s)
                """,
                (source_id, str(station_id), retrieved_at, method, ref.get("source")),
            )
            # per-fuel provenance (§6.6: every station_fuel needs >=1 provenance)
            for grade in station.get("grades", []):
                code = GRADE_CODE_BY_NAME.get(grade["grade"])
                if code is None:
                    continue
                entity_pk = f"{station_id}/{code}"
                self._execute(
                    """
                    INSERT INTO data_provenance
                        (source_id, entity, entity_pk, retrieved_at, method, notes)
                    VALUES (%s, 'station_fuel', %s, %s, %s, %s)
                    """,
                    (source_id, entity_pk, retrieved_at, method, grade["grade"]),
                )

    # -- SQL helpers -------------------------------------------------------- #
    def _scalar(self, sql: str, params: Any) -> Any:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            if row is None:
                raise PipelineError("expected a returned row but got none")
            return row[0]

    def _execute(self, sql: str, params: Any) -> None:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)


def _station_status(station: Dict[str, Any]) -> str:
    for grade in station.get("grades", []):
        if grade.get("status") == "field-verified":
            return "active"
    return "unverified"


def load_stations(
    stations: List[Dict[str, Any]],
    database_url: Optional[str],
    *,
    record_provenance: bool = True,
) -> Dict[str, int]:
    """Load ``stations`` into Postgres in a single transaction. Returns counts."""
    conn = connect(database_url)
    counts = {"stations": 0, "skipped": 0}
    try:
        loader = Loader(conn, record_provenance=record_provenance)
        loader.ensure_reference()
        for station in stations:
            try:
                loader.upsert_station(station)
                counts["stations"] += 1
            except PipelineError as exc:
                log.warning("skipping station %s: %s", station.get("id"), exc)
                counts["skipped"] += 1
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return counts


def _plan_dry_run(stations: List[Dict[str, Any]]) -> Dict[str, Any]:
    brands: Dict[str, int] = {}
    states: set = set()
    cities: set = set()
    fuels = 0
    priced = 0
    for s in stations:
        brands[s["brand"]] = brands.get(s["brand"], 0) + 1
        states.add(s["state"])
        cities.add(s["citySlug"])
        fuels += len(s.get("grades", []))
        if s.get("price"):
            priced += 1
    return {
        "stations": len(stations),
        "byBrand": brands,
        "distinctStates": len(states),
        "distinctCities": len(cities),
        "stationFuelRows": fuels,
        "pricedStations": priced,
    }


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Upsert canonical stations into Postgres with provenance.")
    parser.add_argument("stations", help="Canonical stations JSON (from normalize.py --keep-internal).")
    parser.add_argument("--database-url", help="Override $DATABASE_URL.")
    parser.add_argument("--dry-run", action="store_true", help="Plan and summarise; no DB connection needed.")
    parser.add_argument("--no-provenance", action="store_true", help="Do not append data_provenance rows.")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_arg_parser().parse_args(argv)
    cfg = get_config()

    try:
        data = read_json(args.stations)
    except (OSError, ValueError) as exc:
        log.error("could not read stations file %s: %s", args.stations, exc)
        return 2
    stations = data.get("records") if isinstance(data, dict) else data
    if not isinstance(stations, list):
        log.error("stations file must be a JSON list (or {records: [...]})")
        return 2

    if args.dry_run:
        plan = _plan_dry_run(stations)
        log.info("dry-run plan: %s", plan)
        print(json.dumps(plan, indent=2))
        return 0

    database_url = args.database_url or cfg.database_url
    try:
        counts = load_stations(
            stations, database_url, record_provenance=not args.no_provenance
        )
    except DbUnavailable as exc:
        log.error("database unavailable: %s", exc)
        return 3
    except Exception as exc:  # noqa: BLE001 - report and fail, don't traceback-spam
        log.error("load failed and was rolled back: %s", exc)
        return 1

    log.info("loaded %d stations (%d skipped)", counts["stations"], counts["skipped"])
    print(f"loaded {counts['stations']} stations, {counts['skipped']} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
