"""OctaneFinder data pipeline — canonicalisation.

Maps raw source records (BPCL locator JSON, HPCL product-page rows, IOCL XP100
list rows joined to geo) into the *canonical station schema* — the exact shape of
the ``Station`` TypeScript interface in ``src/lib/types.ts`` and the committed
``data/stations.seed.json``. It is the single Python authority for the domain
reference maps (grades, states, provenance sources), which ``load.py`` also imports.

Doctrine encoded here (memo §0, §C; final-datasources.md §2.3):

* **Official lists seed; the crowd verifies.** Every record produced from an OMC
  list or the BPCL API ships as ``availability="unknown"``, ``lastVerifiedDays=null``,
  ``status="official-listed"`` — a listing is *not* a field verification. Only a
  later check-in moves ``lastVerified`` (memo C.10). We do not fabricate freshness.
* **Price only when authoritative.** The single authoritative price is BPCL
  Speed 100 (₹169.00, source "BPCL locator API"). Every other grade emits
  ``price=null`` — single-source figures never render (memo §0.4, C.16).
* **Coordinates are required for a canonical station.** ``Station.lat/lng`` are
  non-nullable, so a row we cannot locate (an un-geocoded IOCL RO, an
  un-geocoded HPCL row) is emitted to a *pending-geocode* list instead of a
  fabricated point (final-database.md §6.7 "location is nullable").
* **Never a dealer-proprietor name in served data** (DPDP, memo C.17). The
  "M/s ..." legal name is kept only in an internal ``_dealerLegalName`` field for
  matching and is never part of the public ``name``.

Cross-slice note: this script writes to ``PIPELINE_OUT_DIR`` (default
``pipeline/_out``). It never overwrites ``data/stations.seed.json`` — that file is
owned by the FOUNDATION builder.
"""

from __future__ import annotations

import argparse
import dataclasses
import os
import re
import sys
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

from common import (
    get_config,
    get_logger,
    read_json,
    read_json_optional,
    utc_now_iso,
    write_json,
)

__all__ = [
    "GradeName",
    "GRADES",
    "GRADE_CODE_BY_NAME",
    "GRADE_NAME_BY_CODE",
    "BPCL_FUEL_MAP",
    "STATE_TABLE",
    "SOURCE_REGISTRY",
    "to_slug",
    "derive_status",
    "state_lookup",
    "make_station_id",
    "provenance_ref",
    "normalize_bpcl",
    "normalize_hpcl",
    "normalize_iocl",
    "normalize_all",
    "validate_station",
    "NormalizeResult",
]

log = get_logger("normalize")

GradeName = str  # one of the five values in GRADE_CODE_BY_NAME (see below)

# --------------------------------------------------------------------------- #
# Canonical grade reference — mirrors data/grades.json and fuel_types (§6.5).
# --------------------------------------------------------------------------- #
GRADES: List[Dict[str, Any]] = [
    {"name": "XP100", "code": "XP100", "brand": "IOCL", "ron": 100, "e0": True, "legacy": False, "full": "IndianOil XP100"},
    {"name": "poWer 100", "code": "POWER100", "brand": "HPCL", "ron": 100, "e0": True, "legacy": False, "full": "HPCL poWer 100"},
    {"name": "Speed 100", "code": "SPEED100", "brand": "BPCL", "ron": 100, "e0": True, "legacy": False, "full": "BPCL Speed 100"},
    {"name": "poWer 99", "code": "POWER99", "brand": "HPCL", "ron": 99, "e0": None, "legacy": True, "full": "HPCL poWer 99 (legacy)"},
    {"name": "Speed 97", "code": "SPEED97", "brand": "BPCL", "ron": 97, "e0": False, "legacy": True, "full": "BPCL Speed 97 (legacy, E20)"},
]
GRADE_CODE_BY_NAME: Dict[str, str] = {g["name"]: g["code"] for g in GRADES}
GRADE_NAME_BY_CODE: Dict[str, str] = {g["code"]: g["name"] for g in GRADES}

# BPCL live-API fuel strings -> canonical GradeName. Only premium grades map;
# "PETROL"/"DIESEL"/"SPEED"/"E85"/"Hi-SPEED DIESEL" are intentionally ignored.
BPCL_FUEL_MAP: Dict[str, str] = {
    "SPEED 100 BS IV": "Speed 100",
    "SPEED 100": "Speed 100",
    "SPEED 97": "Speed 97",
}

# --------------------------------------------------------------------------- #
# State / UT reference: display name -> (2-letter id code, ISO 3166-2, is_UT).
# The 2-letter code seeds the station id (e.g. "iocl-dl-0421"), matching the
# committed seed. Extend as new states appear in source data.
# --------------------------------------------------------------------------- #
STATE_TABLE: Dict[str, Tuple[str, str, bool]] = {
    "Andhra Pradesh": ("ap", "IN-AP", False),
    "Arunachal Pradesh": ("ar", "IN-AR", False),
    "Assam": ("as", "IN-AS", False),
    "Bihar": ("br", "IN-BR", False),
    "Chhattisgarh": ("cg", "IN-CT", False),
    "Goa": ("ga", "IN-GA", False),
    "Gujarat": ("gj", "IN-GJ", False),
    "Haryana": ("hr", "IN-HR", False),
    "Himachal Pradesh": ("hp", "IN-HP", False),
    "Jharkhand": ("jh", "IN-JH", False),
    "Karnataka": ("ka", "IN-KA", False),
    "Kerala": ("kl", "IN-KL", False),
    "Madhya Pradesh": ("mp", "IN-MP", False),
    "Maharashtra": ("mh", "IN-MH", False),
    "Manipur": ("mn", "IN-MN", False),
    "Meghalaya": ("ml", "IN-ML", False),
    "Mizoram": ("mz", "IN-MZ", False),
    "Nagaland": ("nl", "IN-NL", False),
    "Odisha": ("od", "IN-OR", False),
    "Punjab": ("pb", "IN-PB", False),
    "Rajasthan": ("rj", "IN-RJ", False),
    "Sikkim": ("sk", "IN-SK", False),
    "Tamil Nadu": ("tn", "IN-TN", False),
    "Telangana": ("tg", "IN-TG", False),
    "Tripura": ("tr", "IN-TR", False),
    "Uttar Pradesh": ("up", "IN-UP", False),
    "Uttarakhand": ("uk", "IN-UT", False),
    "West Bengal": ("wb", "IN-WB", False),
    # Union territories
    "Andaman and Nicobar Islands": ("an", "IN-AN", True),
    "Chandigarh": ("ch", "IN-CH", True),
    "Dadra and Nagar Haveli and Daman and Diu": ("dn", "IN-DH", True),
    "Delhi": ("dl", "IN-DL", True),
    "Jammu and Kashmir": ("jk", "IN-JK", True),
    "Ladakh": ("la", "IN-LA", True),
    "Lakshadweep": ("ld", "IN-LD", True),
    "Puducherry": ("py", "IN-PY", True),
}
# Common aliases seen in source data.
_STATE_ALIASES: Dict[str, str] = {
    "orissa": "Odisha",
    "pondicherry": "Puducherry",
    "uttaranchal": "Uttarakhand",
    "nct of delhi": "Delhi",
    "new delhi": "Delhi",
    "j&k": "Jammu and Kashmir",
}


def state_lookup(name: Optional[str]) -> Optional[Tuple[str, str, str, bool]]:
    """Resolve a free-form state string to ``(display, code2, iso, is_ut)``.

    Returns ``None`` when the state cannot be resolved (caller decides whether to
    queue the row for manual review rather than guess).
    """
    if not name:
        return None
    key = name.strip()
    if key in STATE_TABLE:
        code2, iso, is_ut = STATE_TABLE[key]
        return key, code2, iso, is_ut
    alias = _STATE_ALIASES.get(key.lower())
    if alias and alias in STATE_TABLE:
        code2, iso, is_ut = STATE_TABLE[alias]
        return alias, code2, iso, is_ut
    # Case-insensitive exact match.
    for display, (code2, iso, is_ut) in STATE_TABLE.items():
        if display.lower() == key.lower():
            return display, code2, iso, is_ut
    return None


# --------------------------------------------------------------------------- #
# Provenance source registry — one entry per acquisition channel. Feeds both the
# canonical ProvenanceRef (source/license/method strings shown in the app) and
# the DB `sources` + `data_provenance` rows written by load.py (§6.6).
# --------------------------------------------------------------------------- #
SOURCE_REGISTRY: Dict[str, Dict[str, Any]] = {
    "bpcl-cep-api": {
        # canonical ProvenanceRef (matches data/stations.seed.json convention)
        "ref_source": "BPCL locator API",
        "ref_license": "facts:EBC-v-Modak",
        "ref_method": "locator-api",
        # DB `sources` registry columns
        "slug": "bpcl-cep-api",
        "name": "BPCL retail locator API (api.cep.bpcl.in)",
        "publisher": "Bharat Petroleum Corporation Ltd",
        "url": "https://api.cep.bpcl.in/retail/v2/bpcl/retail/rolocators",
        "legal_basis": "unofficial_api",
        "license_name": None,
        "attribution_text": None,
        "terms_notes": "undocumented endpoint, revocable; never a runtime dependency",
        # DB `data_provenance.method` vocabulary
        "provenance_method": "partner_api_probe",
    },
    "iocl-xp100-page": {
        "ref_source": "IOCL XP100 official retail-outlet list",
        "ref_license": "facts:EBC-v-Modak",
        "ref_method": "official-list",
        "slug": "iocl-xp100-page",
        "name": "IndianOil XP100 official retail-outlet list (iocl.com/xp100)",
        "publisher": "Indian Oil Corporation Ltd",
        "url": "https://iocl.com/xp100",
        "legal_basis": "omc_public_page",
        "license_name": None,
        "attribution_text": None,
        "terms_notes": "Sucuri WAF; human-in-browser capture only, no WAF circumvention",
        "provenance_method": "omc_official_list",
    },
    "iocl-locator-sitemap": {
        "ref_source": "IOCL locator (locator.iocl.com) geo join",
        "ref_license": "facts:EBC-v-Modak",
        "ref_method": "locator-sitemap",
        "slug": "iocl-locator-sitemap",
        "name": "IndianOil outlet locator sitemap crawl (locator.iocl.com)",
        "publisher": "Indian Oil Corporation Ltd / SingleInterface",
        "url": "https://locator.iocl.com/sitemap.xml",
        "legal_basis": "omc_public_page",
        "license_name": None,
        "attribution_text": None,
        "terms_notes": "robots-permitted sitemap crawl; slug-id==RO-code join gated on H.1",
        "provenance_method": "omc_official_list",
    },
    "hpcl-power-page": {
        "ref_source": "HPCL poWer product-page outlet table",
        "ref_license": "facts:EBC-v-Modak",
        "ref_method": "product-page-table",
        "slug": "hpcl-power-page",
        "name": "HPCL poWer 99 / poWer 100 product-page outlet tables",
        "publisher": "Hindustan Petroleum Corporation Ltd",
        "url": "https://www.hindustanpetroleum.com/pages/power100",
        "legal_basis": "omc_public_page",
        "license_name": None,
        "attribution_text": None,
        "terms_notes": "static product-page tables; monthly diff",
        "provenance_method": "omc_official_list",
    },
    "community-e20petrol": {
        "ref_source": "community:e20petrol",
        "ref_license": "partner-permission",
        "ref_method": "community-candidate",
        "slug": "crowd-firstparty",
        "name": "Community candidate feed (partner permission only)",
        "publisher": "e20petrol.in (partner)",
        "url": "https://e20petrol.in",
        "legal_basis": "user_submission",
        "license_name": None,
        "attribution_text": None,
        "terms_notes": "status=unverified candidates only; never scraped (C.15)",
        "provenance_method": "user_checkin",
    },
}

# The authoritative Speed 100 price (memo §0.4). Only this grade carries a price.
AUTHORITATIVE_PRICE_GRADE = "Speed 100"
FIELD_VERIFIED_MAX_DAYS = 30  # mirrors src/lib/constants.ts

_COMBINING = re.compile(r"[̀-ͯ]")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_PINCODE = re.compile(r"\b([1-9][0-9]{5})\b")


def to_slug(value: str) -> str:
    """URL-safe slug identical in behaviour to ``toSlug`` in ``src/lib/geo.ts``.

    NFKD-normalise, strip combining marks, lowercase, collapse non-alphanumerics
    to single hyphens, trim leading/trailing hyphens.
    """
    normalized = unicodedata.normalize("NFKD", value)
    stripped = _COMBINING.sub("", normalized).lower()
    hyphenated = _NON_ALNUM.sub("-", stripped)
    return hyphenated.strip("-")


def derive_status(last_verified_days: Optional[int]) -> str:
    """Map days-since-verification to a ``VerificationStatus``.

    ``null`` -> ``official-listed``; ``<= 30`` -> ``field-verified``; else ``stale``.
    Mirrors the FOUNDATION seed derivation and ``src/lib/data.ts``.
    """
    if last_verified_days is None:
        return "official-listed"
    if last_verified_days <= FIELD_VERIFIED_MAX_DAYS:
        return "field-verified"
    return "stale"


def _last4(code: str) -> str:
    digits = re.sub(r"\D", "", code or "")
    if digits:
        return digits[-4:].rjust(4, "0")
    slug = to_slug(code or "")
    return (slug[-4:] or "0000").rjust(4, "0")


def make_station_id(brand: str, state_code2: str, ro_code: str) -> str:
    """Stable station id ``<brand>-<state2>-<last4-of-ro>`` (e.g. ``iocl-dl-0421``)."""
    return f"{brand.lower()}-{state_code2}-{_last4(ro_code)}"


def provenance_ref(source_key: str, retrieved_at: str) -> Dict[str, str]:
    """Build a canonical ``ProvenanceRef`` from the source registry."""
    entry = SOURCE_REGISTRY[source_key]
    return {
        "source": entry["ref_source"],
        "license": entry["ref_license"],
        "retrievedAt": retrieved_at,
        "method": entry["ref_method"],
    }


def _extract_pincode(*candidates: Optional[str]) -> str:
    for c in candidates:
        if not c:
            continue
        m = _PINCODE.search(c)
        if m:
            return m.group(1)
    return ""


def _grade_entry(grade_name: str, retrieved_at: str) -> Dict[str, Any]:
    """A freshly-listed grade: unknown/never-verified/official-listed (memo C.10)."""
    return {
        "grade": grade_name,
        "availability": "unknown",
        "lastVerifiedDays": None,
        "checkins": 0,
        "status": "official-listed",
    }


# --------------------------------------------------------------------------- #
# Per-source normalisers
# --------------------------------------------------------------------------- #
def normalize_bpcl(raw: Dict[str, Any], retrieved_at: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Normalise one BPCL ``pointOfService`` dict into a canonical Station.

    Returns ``None`` when the outlet carries no in-scope premium grade or lacks a
    coordinate. BPCL arrives pre-geocoded (``geoPoint``) and pre-priced.
    """
    when = retrieved_at or utc_now_iso()
    fuels_raw = [str(f) for f in (raw.get("fuelAvailable") or [])]
    grade_names = []
    for f in fuels_raw:
        mapped = BPCL_FUEL_MAP.get(f.strip().upper()) or BPCL_FUEL_MAP.get(f.strip())
        if mapped and mapped not in grade_names:
            grade_names.append(mapped)
    if not grade_names:
        return None

    geo = raw.get("geoPoint") or {}
    lat = geo.get("latitude")
    lng = geo.get("longitude")
    if lat is None or lng is None:
        return None

    address_obj = raw.get("address") or {}
    state_name = ((address_obj.get("region") or {}).get("name"))
    resolved = state_lookup(state_name)
    if resolved is None:
        log.debug("BPCL outlet %s: unresolved state %r; skipping", raw.get("roId"), state_name)
        return None
    state_display, state_code2, _iso, _ut = resolved

    ro_code = str(raw.get("roId") or "").strip()
    if not ro_code:
        return None

    city = (address_obj.get("town") or address_obj.get("district") or "").title().strip()
    name = _clean_bpcl_name(raw.get("displayName") or raw.get("name") or "BPCL Fuel Station")
    address = address_obj.get("formattedAddress") or address_obj.get("line1") or ""
    pincode = _extract_pincode(str(address_obj.get("postalCode") or ""), address)
    phone = _clean_phone(raw.get("telephone") or address_obj.get("cellphone"))

    grades = [_grade_entry(g, when) for g in grade_names]

    price = None
    if AUTHORITATIVE_PRICE_GRADE in grade_names:
        price = _bpcl_speed100_price(raw, when)

    station = {
        "id": make_station_id("BPCL", state_code2, ro_code),
        "slug": to_slug(f"{city} {name}") or to_slug(name),
        "name": name,
        "brand": "BPCL",
        "city": city or state_display,
        "citySlug": to_slug(city) or to_slug(state_display),
        "state": state_display,
        "pincode": pincode,
        "lat": round(float(lat), 6),
        "lng": round(float(lng), 6),
        "roCode": ro_code,
        "address": address.strip(),
        "phone": phone,
        "grades": grades,
        "price": price,
        "sources": [provenance_ref("bpcl-cep-api", when)],
        "firstSeen": when,
        "lastVerified": None,
        # Internal-only fields (never served; consumed by load.py). Prefixed "_".
        "_dealerLegalName": (raw.get("name") or "").strip() or None,
        "_omcCode": ro_code,
    }
    return station


def _bpcl_speed100_price(raw: Dict[str, Any], when: str) -> Optional[Dict[str, str]]:
    for entry in raw.get("weekDayFuelPriceList") or []:
        code = str(entry.get("code") or entry.get("displayName") or "")
        if BPCL_FUEL_MAP.get(code.strip().upper()) == AUTHORITATIVE_PRICE_GRADE:
            value = entry.get("price")
            if value is None:
                continue
            as_of = str(entry.get("date") or when)[:10]
            return {
                "grade": AUTHORITATIVE_PRICE_GRADE,
                "value": f"{float(value):.2f}",
                "currency": "INR",
                "source": SOURCE_REGISTRY["bpcl-cep-api"]["ref_source"],
                "asOf": as_of,
            }
    return None


def _clean_bpcl_name(name: str) -> str:
    """Trim BPCL boilerplate ("... BHARAT PETROLEUM DEALERS") to a display name."""
    text = re.sub(r"\s+", " ", name).strip()
    for suffix in ("BHARAT PETROLEUM DEALERS", "BHARAT PETROLEUM DEALER", "BHARAT PETROLEUM"):
        idx = text.upper().find(suffix)
        if idx > 0:
            text = text[:idx].strip(" -,")
            break
    return text.title() if text.isupper() else text


def _clean_phone(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    digits = re.sub(r"[^0-9+]", "", str(value))
    return digits or None


def normalize_hpcl(
    row: Dict[str, Any],
    retrieved_at: Optional[str] = None,
    geocode: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Normalise one HPCL product-page row (``power99`` / ``power100``).

    HPCL rows have no coordinates; a ``geocode`` dict (``{lat, lng, pincode?}``,
    from the hand-geocoding pass) is required to emit a canonical Station,
    otherwise ``None`` is returned so the row is queued for geocoding.
    """
    when = retrieved_at or utc_now_iso()
    grade_name = row.get("grade")
    if grade_name not in GRADE_CODE_BY_NAME:
        return None
    resolved = state_lookup(row.get("state"))
    if resolved is None:
        return None
    state_display, state_code2, _iso, _ut = resolved

    if not geocode or geocode.get("lat") is None or geocode.get("lng") is None:
        return None

    name = re.sub(r"\s+", " ", str(row.get("outletName") or "")).strip()
    if not name:
        return None
    city = str(row.get("city") or "").strip()
    address = str(row.get("address") or "").strip()
    ro_code = str(row.get("roCode") or _synthetic_hpcl_code(name, city, state_display))
    pincode = _extract_pincode(str(geocode.get("pincode") or ""), address)

    station = {
        "id": make_station_id("HPCL", state_code2, ro_code),
        "slug": to_slug(f"{city} {name}") or to_slug(name),
        "name": name,
        "brand": "HPCL",
        "city": city or state_display,
        "citySlug": to_slug(city) or to_slug(state_display),
        "state": state_display,
        "pincode": pincode,
        "lat": round(float(geocode["lat"]), 6),
        "lng": round(float(geocode["lng"]), 6),
        "roCode": ro_code,
        "address": address,
        "phone": _clean_phone(row.get("tel")),
        "grades": [_grade_entry(grade_name, when)],
        "price": None,  # HPCL premium prices are single-source only -> never rendered
        "sources": [provenance_ref("hpcl-power-page", when)],
        "firstSeen": when,
        "lastVerified": None,
        "_dealerLegalName": name if name.lower().startswith("m/s") else None,
        "_omcCode": ro_code,
    }
    return station


def _synthetic_hpcl_code(name: str, city: str, state: str) -> str:
    """Stable synthetic RO code for HPCL rows (no official code published)."""
    import hashlib

    digest = hashlib.sha1(f"{name}|{city}|{state}".encode("utf-8")).hexdigest()
    return "HP" + digest[:8].upper()


def normalize_iocl(
    row: Dict[str, Any],
    retrieved_at: Optional[str] = None,
    geo: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Normalise one IOCL XP100 list row joined to a geo record.

    The XP100 list carries only region/sales-area/RO-name/RO-code — no address or
    coordinates. A ``geo`` dict (``{lat, lng, address?, city?, state?, pincode?}``
    from the locator-sitemap join, H.1-gated) is required; without it the row is
    returned as ``None`` and queued for geocoding.
    """
    when = retrieved_at or utc_now_iso()
    ro_code = str(row.get("roCode") or "").strip()
    name = re.sub(r"\s+", " ", str(row.get("name") or "")).strip()
    if not ro_code or not name:
        return None
    if not geo or geo.get("lat") is None or geo.get("lng") is None:
        return None

    state_name = geo.get("state") or row.get("state")
    resolved = state_lookup(state_name)
    if resolved is None:
        return None
    state_display, state_code2, _iso, _ut = resolved

    city = str(geo.get("city") or row.get("salesArea") or "").strip()
    address = str(geo.get("address") or "").strip()
    pincode = _extract_pincode(str(geo.get("pincode") or ""), address)
    display_name = _iocl_display_name(name)

    station = {
        "id": make_station_id("IOCL", state_code2, ro_code),
        "slug": to_slug(f"{city} {display_name}") or to_slug(display_name),
        "name": display_name,
        "brand": "IOCL",
        "city": city or state_display,
        "citySlug": to_slug(city) or to_slug(state_display),
        "state": state_display,
        "pincode": pincode,
        "lat": round(float(geo["lat"]), 6),
        "lng": round(float(geo["lng"]), 6),
        "roCode": ro_code,
        "address": address,
        "phone": _clean_phone(geo.get("phone")),
        "grades": [_grade_entry("XP100", when)],
        "price": None,  # XP100 has no authoritative price source -> null
        "sources": [
            provenance_ref("iocl-xp100-page", when),
            provenance_ref("iocl-locator-sitemap", when),
        ],
        "firstSeen": when,
        "lastVerified": None,
        "_dealerLegalName": name,
        "_omcCode": ro_code,
    }
    return station


def _iocl_display_name(dealer_name: str) -> str:
    """Public display name: prefer "IndianOil, <locality>" over the dealer name.

    The raw XP100 list gives dealer names ("GUPTA SERVICE STATION-MOTI BAGH").
    We never present a dealer-proprietor's personal name (memo C.17); we present a
    brand-anchored name and keep the raw string only in ``_dealerLegalName``.
    """
    cleaned = dealer_name.title() if dealer_name.isupper() else dealer_name
    return f"IndianOil — {cleaned}"


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #
_REQUIRED_STATION_FIELDS = (
    "id", "slug", "name", "brand", "city", "citySlug", "state", "pincode",
    "lat", "lng", "roCode", "address", "phone", "grades", "price", "sources",
    "firstSeen", "lastVerified",
)


def validate_station(station: Dict[str, Any]) -> List[str]:
    """Return a list of validation problems (empty == valid canonical Station)."""
    problems: List[str] = []
    for field in _REQUIRED_STATION_FIELDS:
        if field not in station:
            problems.append(f"missing field: {field}")
    if problems:
        return problems

    if station["brand"] not in {"IOCL", "HPCL", "BPCL"}:
        problems.append(f"invalid brand: {station['brand']!r}")
    if not isinstance(station["lat"], (int, float)) or not isinstance(station["lng"], (int, float)):
        problems.append("lat/lng must be numeric")
    else:
        if not (6.0 <= float(station["lat"]) <= 38.0):
            problems.append(f"lat out of India range: {station['lat']}")
        if not (68.0 <= float(station["lng"]) <= 98.0):
            problems.append(f"lng out of India range: {station['lng']}")
    grades = station.get("grades")
    if not isinstance(grades, list) or not grades:
        problems.append("grades must be a non-empty list")
    else:
        for g in grades:
            if g.get("grade") not in GRADE_CODE_BY_NAME:
                problems.append(f"unknown grade: {g.get('grade')!r}")
            if g.get("availability") not in {"in_stock", "out_of_stock", "unknown"}:
                problems.append(f"invalid availability: {g.get('availability')!r}")
    price = station.get("price")
    if price is not None:
        if price.get("grade") != AUTHORITATIVE_PRICE_GRADE:
            problems.append("only Speed 100 may carry a price (memo §0.4)")
        if price.get("source") != SOURCE_REGISTRY["bpcl-cep-api"]["ref_source"]:
            problems.append("price must cite the authoritative BPCL source")
    if not isinstance(station.get("sources"), list) or not station["sources"]:
        problems.append("sources must be a non-empty list")
    return problems


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #
@dataclasses.dataclass
class NormalizeResult:
    """Outcome of a full normalisation run."""

    stations: List[Dict[str, Any]]
    pending_geocode: List[Dict[str, Any]]
    rejected: List[Dict[str, Any]]

    def summary(self) -> Dict[str, int]:
        return {
            "stations": len(self.stations),
            "pending_geocode": len(self.pending_geocode),
            "rejected": len(self.rejected),
        }


def normalize_all(
    *,
    bpcl_raw: Optional[List[Dict[str, Any]]] = None,
    hpcl_rows: Optional[List[Dict[str, Any]]] = None,
    hpcl_geocode: Optional[Dict[str, Any]] = None,
    iocl_rows: Optional[List[Dict[str, Any]]] = None,
    iocl_geo: Optional[Dict[str, Any]] = None,
    retrieved_at: Optional[str] = None,
) -> NormalizeResult:
    """Normalise all provided harvests into a deduplicated canonical station set.

    Dedup key is ``(brand, roCode)``; when the same outlet appears twice its grade
    lists are merged. Rows without coordinates go to ``pending_geocode``.
    """
    when = retrieved_at or utc_now_iso()
    by_key: Dict[Tuple[str, str], Dict[str, Any]] = {}
    pending: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []
    hpcl_geocode = hpcl_geocode or {}
    iocl_geo = iocl_geo or {}

    def _keep(candidate: Optional[Dict[str, Any]], src_row: Dict[str, Any]) -> None:
        if candidate is None:
            return
        problems = validate_station(candidate)
        if problems:
            rejected.append({"row": src_row, "problems": problems})
            return
        key = (candidate["brand"], candidate["roCode"])
        if key in by_key:
            _merge_grades(by_key[key], candidate)
        else:
            by_key[key] = candidate

    for raw in bpcl_raw or []:
        station = normalize_bpcl(raw, when)
        if station is None:
            # Either no premium grade (silently drop) or missing geo/state.
            if any(BPCL_FUEL_MAP.get(str(f).strip().upper()) for f in (raw.get("fuelAvailable") or [])):
                pending.append({"source": "bpcl", "raw": raw, "reason": "unresolved-state-or-geo"})
            continue
        _keep(station, raw)

    for row in hpcl_rows or []:
        geocode = _match_geocode(hpcl_geocode, row)
        station = normalize_hpcl(row, when, geocode)
        if station is None and row.get("grade") in GRADE_CODE_BY_NAME:
            pending.append({"source": "hpcl", "row": row, "reason": "needs-geocode"})
            continue
        _keep(station, row)

    for row in iocl_rows or []:
        geo = iocl_geo.get(str(row.get("roCode") or "").strip())
        station = normalize_iocl(row, when, geo)
        if station is None:
            pending.append({"source": "iocl", "row": row, "reason": "needs-geo-join"})
            continue
        _keep(station, row)

    stations = sorted(by_key.values(), key=lambda s: (s["state"], s["city"], s["name"]))
    return NormalizeResult(stations=stations, pending_geocode=pending, rejected=rejected)


def _merge_grades(existing: Dict[str, Any], incoming: Dict[str, Any]) -> None:
    have = {g["grade"] for g in existing["grades"]}
    for g in incoming["grades"]:
        if g["grade"] not in have:
            existing["grades"].append(g)
            have.add(g["grade"])
    if existing.get("price") is None and incoming.get("price") is not None:
        existing["price"] = incoming["price"]
    have_sources = {(s["source"], s["method"]) for s in existing["sources"]}
    for s in incoming["sources"]:
        if (s["source"], s["method"]) not in have_sources:
            existing["sources"].append(s)


def _match_geocode(geocode_map: Dict[str, Any], row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Look up a hand-geocode by RO code, then by normalised name+city key."""
    if not geocode_map:
        return None
    ro = str(row.get("roCode") or "").strip()
    if ro and ro in geocode_map:
        return geocode_map[ro]
    name_key = to_slug(f"{row.get('outletName', '')} {row.get('city', '')}")
    return geocode_map.get(name_key)


def _strip_internal(station: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy with internal ``_``-prefixed fields removed (public shape)."""
    return {k: v for k, v in station.items() if not k.startswith("_")}


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _load_optional(path: Optional[str]) -> Optional[Any]:
    if not path:
        return None
    data = read_json_optional(path)
    if data is None:
        log.warning("input not found, skipping: %s", path)
    return data


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Normalise raw source harvests into the canonical station schema."
    )
    parser.add_argument("--bpcl", help="BPCL harvest JSON (list of raw pointOfService dicts)")
    parser.add_argument("--hpcl", help="HPCL harvest JSON (list of product-page rows)")
    parser.add_argument("--hpcl-geocode", help="HPCL hand-geocode map JSON (roCode/nameKey -> {lat,lng})")
    parser.add_argument("--iocl", help="IOCL XP100 harvest JSON (list of list rows)")
    parser.add_argument("--iocl-geo", help="IOCL geo-join map JSON (roCode -> {lat,lng,...})")
    parser.add_argument(
        "--out",
        help="Output path for canonical stations JSON "
        "(default: $PIPELINE_OUT_DIR/stations.normalized.json). "
        "NOTE: never write to data/stations.seed.json — that is FOUNDATION-owned.",
    )
    parser.add_argument(
        "--keep-internal",
        action="store_true",
        help="Retain internal _-prefixed fields (for load.py); default strips them.",
    )
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_arg_parser().parse_args(argv)
    cfg = get_config()

    bpcl_raw = _load_optional(args.bpcl)
    hpcl_rows = _load_optional(args.hpcl)
    hpcl_geocode = _load_optional(args.hpcl_geocode)
    iocl_rows = _load_optional(args.iocl)
    iocl_geo = _load_optional(args.iocl_geo)

    # Harvest files may be wrapped as {"records": [...]} or a bare list.
    def _records(obj: Any) -> Optional[List[Dict[str, Any]]]:
        if obj is None:
            return None
        if isinstance(obj, dict) and "records" in obj:
            return obj["records"]
        if isinstance(obj, list):
            return obj
        return None

    result = normalize_all(
        bpcl_raw=_records(bpcl_raw),
        hpcl_rows=_records(hpcl_rows),
        hpcl_geocode=hpcl_geocode if isinstance(hpcl_geocode, dict) else None,
        iocl_rows=_records(iocl_rows),
        iocl_geo=iocl_geo if isinstance(iocl_geo, dict) else None,
    )

    out_path = args.out or os.path.join(cfg.out_dir, "stations.normalized.json")
    stations = (
        result.stations if args.keep_internal else [_strip_internal(s) for s in result.stations]
    )
    write_json(out_path, stations)
    if result.pending_geocode:
        write_json(os.path.join(cfg.out_dir, "pending_geocode.json"), result.pending_geocode)
    if result.rejected:
        write_json(os.path.join(cfg.out_dir, "rejected.json"), result.rejected)

    log.info("normalised -> %s (%s)", out_path, result.summary())
    print(f"normalized {len(stations)} stations -> {out_path}")
    print(f"pending geocode: {len(result.pending_geocode)}, rejected: {len(result.rejected)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
