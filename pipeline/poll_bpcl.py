"""OctaneFinder data pipeline — BPCL locator poll.

Polls the (unofficial, unauthenticated) BPCL retail locator API on a hexagonal
grid over India, snapshotting **every** raw response with its retrieval date to
the object store, then extracts the premium-grade (Speed 100 / Speed 97) outlets
for the normaliser.

    GET https://api.cep.bpcl.in/retail/v2/bpcl/retail/rolocators
        ?latitude={lat}&longitude={lon}

Doctrine (final-datasources.md §2.2.2, memo C):

* This endpoint is the best data asset we found *and* the most fragile: no
  developer program, no ToS, no SLA — it can gain auth or vanish without notice.
  Consume it **politely** (identified UA, rate-limited, off-peak) and treat it as
  **never a runtime dependency**. Every response is snapshotted before parsing so
  freshness degrades gracefully to check-ins if the endpoint closes.
* We obey ``robots.txt`` and never circumvent access controls. If a poll cannot
  run (network down, robots disallow, endpoint gone), the script logs and exits
  non-zero — it does not crash and it does not retry with evasive tooling.
* The query parameters are exactly ``latitude`` / ``longitude`` (the endpoint is
  parameter-name-sensitive — memo/research note).

Scheduling: run **daily, off-peak** (see the cron note in ``pipeline/README.md``).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from typing import Any, Dict, Iterator, List, Optional, Tuple

from common import (
    NetworkUnavailable,
    PipelineError,
    PoliteSession,
    RobotsDisallowed,
    get_config,
    get_logger,
    get_object_store,
    snapshot,
    today_str,
    utc_now_iso,
    write_json,
)
from normalize import BPCL_FUEL_MAP

log = get_logger("poll_bpcl")

BPCL_ROLOCATOR_URL = "https://api.cep.bpcl.in/retail/v2/bpcl/retail/rolocators"

# India mainland + islands bounding box (lat_min, lng_min, lat_max, lng_max).
INDIA_BBOX: Tuple[float, float, float, float] = (6.5, 68.0, 37.1, 97.5)

# Metro centroids — the "cities" mode. Premium grades cluster in a small number
# of cities, so a handful of centroid probes covers the premium universe far more
# cheaply than a national grid (final-datasources.md §2.2.2: "a few hundred
# requests"). These mirror the origin cities in data/origins.json plus known
# premium metros.
METRO_CENTROIDS: List[Tuple[str, float, float]] = [
    ("Delhi", 28.6139, 77.2090),
    ("Mumbai", 19.0760, 72.8777),
    ("Bengaluru", 12.9716, 77.5946),
    ("Chennai", 13.0827, 80.2707),
    ("Hyderabad", 17.3850, 78.4867),
    ("Pune", 18.5204, 73.8567),
    ("Kolkata", 22.5726, 88.3639),
    ("Ahmedabad", 23.0225, 72.5714),
    ("Jaipur", 26.9124, 75.7873),
    ("Chandigarh", 30.7333, 76.7794),
    ("Lucknow", 26.8467, 80.9462),
    ("Gurugram", 28.4595, 77.0266),
]

# Approximate great-circle scale factors.
_KM_PER_DEG_LAT = 110.574
_KM_PER_DEG_LNG_EQUATOR = 111.320


def hex_grid(
    bbox: Tuple[float, float, float, float], spacing_km: float
) -> Iterator[Tuple[float, float]]:
    """Yield ``(lat, lng)`` centres of a hexagonally-packed grid over ``bbox``.

    Rows are offset by half a column on alternate rows and spaced vertically by
    ``spacing * sqrt(3)/2`` (true hex packing); longitude spacing is corrected by
    ``cos(latitude)`` so cells stay roughly ``spacing_km`` apart on the ground.
    """
    lat_min, lng_min, lat_max, lng_max = bbox
    if spacing_km <= 0:
        raise ValueError("spacing_km must be positive")
    lat_step = spacing_km / _KM_PER_DEG_LAT
    row_v_step = lat_step * (math.sqrt(3) / 2.0)
    lat = lat_min
    row = 0
    while lat <= lat_max + 1e-9:
        km_per_deg_lng = max(_KM_PER_DEG_LNG_EQUATOR * math.cos(math.radians(lat)), 1e-3)
        lng_step = spacing_km / km_per_deg_lng
        offset = (lng_step / 2.0) if (row % 2 == 1) else 0.0
        lng = lng_min + offset
        while lng <= lng_max + 1e-9:
            yield (round(lat, 6), round(lng, 6))
            lng += lng_step
        lat += row_v_step
        row += 1


def _has_premium(point_of_service: Dict[str, Any]) -> bool:
    for fuel in point_of_service.get("fuelAvailable") or []:
        if BPCL_FUEL_MAP.get(str(fuel).strip().upper()):
            return True
    return False


def _extract_point_of_services(payload: Any) -> List[Dict[str, Any]]:
    """Pull the outlet list out of a locator payload, defensively.

    Known shape: ``{"pointOfServices": [...], "status": ..., "statusCode": ...}``.
    We also accept a couple of plausible alternates so a minor server-side rename
    degrades to "empty" rather than a crash.
    """
    if isinstance(payload, dict):
        for key in ("pointOfServices", "pointOfService", "data", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return [p for p in value if isinstance(p, dict)]
    if isinstance(payload, list):
        return [p for p in payload if isinstance(p, dict)]
    return []


class BpclPoller:
    """Runs the grid poll, snapshots raw responses, and dedupes premium outlets."""

    def __init__(self, session: Optional[PoliteSession] = None) -> None:
        self.config = get_config()
        self.session = session or PoliteSession(self.config)
        self.store = get_object_store(self.config)

    def poll_point(
        self, lat: float, lng: float, *, dry_run: bool = False
    ) -> List[Dict[str, Any]]:
        """Fetch and snapshot one grid point; return its premium outlets.

        Raises :class:`NetworkUnavailable` on unrecoverable transport failure so
        the caller can decide whether to continue the sweep or abort.
        """
        url = f"{BPCL_ROLOCATOR_URL}?latitude={lat}&longitude={lng}"
        if dry_run:
            log.info("[dry-run] would GET %s", url)
            return []
        resp = self.session.get(url, accept="application/json")
        retrieved_at = utc_now_iso()
        # Snapshot the raw bytes BEFORE parsing (evidence locker).
        snap = snapshot(
            self.store,
            source="bpcl-cep-api",
            identifier=f"rolocators-{lat}-{lng}",
            content=resp.content,
            content_type=resp.headers.get("content-type", "application/json"),
            retrieved_at=retrieved_at,
            url=url,
            status=resp.status,
            method="api-probe",
            notes="BPCL rolocators hex-grid probe",
        )
        log.debug("snapshot %s (%d bytes, sha=%s)", snap.key, snap.bytes, snap.sha256[:12])

        if resp.status >= 400:
            log.warning("BPCL returned HTTP %s at (%s, %s)", resp.status, lat, lng)
            return []
        try:
            payload = resp.json()
        except json.JSONDecodeError as exc:
            log.warning("non-JSON BPCL response at (%s, %s): %s", lat, lng, exc)
            return []

        outlets = _extract_point_of_services(payload)
        premium = [p for p in outlets if _has_premium(p)]
        log.debug("(%s, %s): %d outlets, %d premium", lat, lng, len(outlets), len(premium))
        return premium

    def sweep(
        self,
        points: List[Tuple[float, float]],
        *,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """Poll every point; dedupe premium outlets by ``roId``.

        Returns a harvest dict ``{"records": [...], ...}`` suitable for
        normalize.py. Transport failures are counted, not fatal (an unofficial
        endpoint being flaky is expected); a total wipe-out (0 successes) is
        reported so the scheduler can alert.
        """
        seen: Dict[str, Dict[str, Any]] = {}
        ok_points = 0
        failed_points = 0
        for i, (lat, lng) in enumerate(points, start=1):
            try:
                premium = self.poll_point(lat, lng, dry_run=dry_run)
                ok_points += 1
            except RobotsDisallowed as exc:
                log.error("robots.txt disallows the BPCL endpoint; aborting: %s", exc)
                raise
            except NetworkUnavailable as exc:
                failed_points += 1
                log.warning("point %d/%d (%s,%s) failed: %s", i, len(points), lat, lng, exc)
                continue
            for pos in premium:
                ro_id = str(pos.get("roId") or "").strip()
                if not ro_id:
                    continue
                seen[ro_id] = pos  # last write wins (freshest price)
            if i % 25 == 0:
                log.info("progress: %d/%d points, %d premium outlets", i, len(points), len(seen))

        harvest = {
            "source": "bpcl-cep-api",
            "retrievedAt": utc_now_iso(),
            "pointsPolled": len(points),
            "pointsOk": ok_points,
            "pointsFailed": failed_points,
            "premiumOutlets": len(seen),
            "records": list(seen.values()),
        }
        return harvest


def _resolve_points(args: argparse.Namespace) -> List[Tuple[float, float]]:
    if args.seed_points:
        raw = json.load(open(args.seed_points, "r", encoding="utf-8"))
        pts = [(float(p["lat"]), float(p["lng"])) for p in raw]
        log.info("loaded %d seed points from %s", len(pts), args.seed_points)
        return pts
    if args.mode == "cities":
        return [(lat, lng) for _name, lat, lng in METRO_CENTROIDS]
    bbox = INDIA_BBOX
    if args.bbox:
        parts = [float(x) for x in args.bbox.split(",")]
        if len(parts) != 4:
            raise SystemExit("--bbox expects lat_min,lng_min,lat_max,lng_max")
        bbox = (parts[0], parts[1], parts[2], parts[3])
    pts = list(hex_grid(bbox, args.spacing_km))
    if args.max_cells and len(pts) > args.max_cells:
        log.warning("grid has %d cells; capping at --max-cells=%d", len(pts), args.max_cells)
        pts = pts[: args.max_cells]
    return pts


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Poll the BPCL locator API for premium outlets.")
    parser.add_argument(
        "--mode",
        choices=("cities", "grid"),
        default="cities",
        help="'cities' probes metro centroids (default; cheapest); 'grid' sweeps a hex grid.",
    )
    parser.add_argument("--spacing-km", type=float, default=25.0, help="Hex-grid spacing (grid mode).")
    parser.add_argument("--bbox", help="Override bbox 'lat_min,lng_min,lat_max,lng_max' (grid mode).")
    parser.add_argument("--max-cells", type=int, default=2000, help="Safety cap on grid cells (0 = no cap).")
    parser.add_argument("--seed-points", help="JSON file of [{lat,lng}, ...] to poll instead.")
    parser.add_argument("--out", help="Harvest output path (default $PIPELINE_OUT_DIR/bpcl-harvest-<date>.json).")
    parser.add_argument("--dry-run", action="store_true", help="Plan and snapshot nothing; log intended requests.")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_arg_parser().parse_args(argv)
    cfg = get_config()

    try:
        points = _resolve_points(args)
    except (OSError, ValueError, KeyError) as exc:
        log.error("could not resolve poll points: %s", exc)
        return 2

    log.info("BPCL poll: mode=%s, points=%d, dry_run=%s", args.mode, len(points), args.dry_run)
    poller = BpclPoller()
    try:
        harvest = poller.sweep(points, dry_run=args.dry_run)
    except RobotsDisallowed:
        return 3
    except PipelineError as exc:
        log.error("poll aborted: %s", exc)
        return 1

    out_path = args.out or f"{cfg.out_dir}/bpcl-harvest-{today_str()}.json"
    if not args.dry_run:
        write_json(out_path, harvest)

    log.info(
        "done: %d premium outlets from %d/%d points (%d failed) -> %s",
        harvest["premiumOutlets"], harvest["pointsOk"], harvest["pointsPolled"],
        harvest["pointsFailed"], out_path,
    )
    print(json.dumps({k: v for k, v in harvest.items() if k != "records"}, indent=2))

    if not args.dry_run and harvest["pointsOk"] == 0:
        log.error("every point failed — endpoint may be down or gated; check snapshots")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
