"""OctaneFinder data pipeline — HPCL product-page diff.

Fetches the HPCL poWer 99 / poWer 100 product pages, snapshots the raw HTML,
parses the small "Selling Outlets" table, and diffs it against the previous
captured parse to alert on adds/removes/changes. HPCL publishes premium
availability *only* as these two static HTML tables (~51 rows total), with no
coordinates and no prices.

    https://www.hindustanpetroleum.com/pages/power100   (~21 rows -> "poWer 100")
    https://www.hindustanpetroleum.com/pages/power99     (~30 rows -> "poWer 99")

Table columns (verified 2026-07-28):
    Sr. No. | Outlet Name | State | City | Address | Tel No.

Doctrine (final-datasources.md §2.2.3, memo §0.4):

* These are static, tiny tables — parse politely, snapshot, diff **monthly**.
* HPCL premium prices are single-source / irreconcilable, so this pipeline never
  emits a price for poWer 99 / poWer 100 (handled in normalize.py).
* Rows have no geo; the normaliser hand-geocodes the ~51 rows once. Here we only
  produce the row harvest and the diff report.

HTML parsing uses the standard library (``html.parser``) — no third-party
dependency — so the script runs in a bare interpreter and never breaks the build.

Scheduling: run **monthly** (see the cron note in ``pipeline/README.md``).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional, Tuple

from common import (
    NetworkUnavailable,
    PoliteSession,
    RobotsDisallowed,
    get_config,
    get_logger,
    get_object_store,
    read_json_optional,
    snapshot,
    today_str,
    utc_now_iso,
    write_json,
)

log = get_logger("diff_hpcl")

HPCL_PAGES: Dict[str, Tuple[str, str]] = {
    # key -> (url, canonical GradeName)
    "power100": ("https://www.hindustanpetroleum.com/pages/power100", "poWer 100"),
    "power99": ("https://www.hindustanpetroleum.com/pages/power99", "poWer 99"),
}

# Header cells we recognise, mapped to harvest field names.
_HEADER_MAP = {
    "sr. no.": "srNo",
    "sr no.": "srNo",
    "s.no.": "srNo",
    "outlet name": "outletName",
    "state": "state",
    "city": "city",
    "address": "address",
    "tel no.": "tel",
    "tel no": "tel",
    "telephone": "tel",
}


class _TableExtractor(HTMLParser):
    """Extract every HTML ``<table>`` as a list of rows (each row a list of cells).

    Stdlib-only; tolerant of the messy real-world markup on OMC pages. Nested
    tables are flattened into the outer table's rows, which is fine for the flat
    product-page layout we target.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: List[List[List[str]]] = []
        self._table_depth = 0
        self._current: Optional[List[List[str]]] = None
        self._row: Optional[List[str]] = None
        self._cell_parts: Optional[List[str]] = None
        self._in_cell = False

    def handle_starttag(self, tag: str, attrs: Any) -> None:  # noqa: D401
        if tag == "table":
            self._table_depth += 1
            if self._table_depth == 1:
                self._current = []
                self.tables.append(self._current)
        elif tag == "tr" and self._current is not None:
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._in_cell = True
            self._cell_parts = []
        elif tag == "br" and self._in_cell and self._cell_parts is not None:
            self._cell_parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag == "table" and self._table_depth > 0:
            self._table_depth -= 1
            if self._table_depth == 0:
                self._current = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                assert self._current is not None
                self._current.append(self._row)
            self._row = None
        elif tag in ("td", "th") and self._in_cell:
            text = " ".join("".join(self._cell_parts or []).split())
            if self._row is not None:
                self._row.append(text)
            self._in_cell = False
            self._cell_parts = None

    def handle_data(self, data: str) -> None:
        if self._in_cell and self._cell_parts is not None:
            self._cell_parts.append(data)

    def handle_comment(self, data: str) -> None:
        # Real-world OMC captures sometimes wrap the outlet table in an HTML
        # comment (rendered client-side). Parse tables found inside comments too.
        if "<table" in data.lower():
            nested = _TableExtractor()
            try:
                nested.feed(data)
            except Exception:  # noqa: BLE001
                return
            self.tables.extend(nested.tables)


def parse_outlet_table(html: str, grade: str) -> List[Dict[str, Any]]:
    """Parse the HPCL "Selling Outlets" table out of ``html`` into row dicts.

    Finds the table whose header row matches the expected columns and returns one
    dict per data row, tagged with the canonical ``grade``. Returns ``[]`` if no
    recognisable table is present (page redesign / WAF interstitial) — the caller
    treats that as "no data", not a crash.
    """
    extractor = _TableExtractor()
    try:
        extractor.feed(html)
    except Exception as exc:  # noqa: BLE001 - malformed markup should not crash us
        log.warning("HTML parse error for %s table: %s", grade, exc)
        return []

    for table in extractor.tables:
        if not table:
            continue
        header = [c.strip().lower() for c in table[0]]
        field_by_index: Dict[int, str] = {}
        for idx, cell in enumerate(header):
            if cell in _HEADER_MAP:
                field_by_index[idx] = _HEADER_MAP[cell]
        # A valid outlet table has at least Outlet Name + State + City columns.
        needed = {"outletName", "state", "city"}
        if not needed.issubset(set(field_by_index.values())):
            continue
        rows: List[Dict[str, Any]] = []
        for raw_row in table[1:]:
            if not any(cell.strip() for cell in raw_row):
                continue
            record: Dict[str, Any] = {"grade": grade}
            for idx, field in field_by_index.items():
                record[field] = raw_row[idx].strip() if idx < len(raw_row) else ""
            if record.get("outletName"):
                rows.append(record)
        if rows:
            log.info("parsed %d rows for %s", len(rows), grade)
            return rows
    log.warning("no recognisable outlet table found for %s", grade)
    return []


def _row_key(row: Dict[str, Any]) -> str:
    """Stable identity for diffing: normalised outlet name + city."""
    name = str(row.get("outletName", "")).strip().lower()
    city = str(row.get("city", "")).strip().lower()
    return f"{name}|{city}"


def diff_rows(
    previous: List[Dict[str, Any]], current: List[Dict[str, Any]]
) -> Dict[str, List[Dict[str, Any]]]:
    """Compute added / removed / changed rows between two parses."""
    prev_by_key = {_row_key(r): r for r in previous}
    curr_by_key = {_row_key(r): r for r in current}
    added = [curr_by_key[k] for k in curr_by_key if k not in prev_by_key]
    removed = [prev_by_key[k] for k in prev_by_key if k not in curr_by_key]
    changed: List[Dict[str, Any]] = []
    for k in curr_by_key:
        if k in prev_by_key and prev_by_key[k] != curr_by_key[k]:
            changed.append({"before": prev_by_key[k], "after": curr_by_key[k]})
    return {"added": added, "removed": removed, "changed": changed}


class HpclDiffer:
    def __init__(self, session: Optional[PoliteSession] = None) -> None:
        self.config = get_config()
        self.session = session or PoliteSession(self.config)
        self.store = get_object_store(self.config)

    def fetch_and_parse(self, key: str) -> Optional[List[Dict[str, Any]]]:
        """Fetch one HPCL page, snapshot the HTML, and parse its outlet table.

        Returns ``None`` on transport failure (so the caller keeps the previous
        parse rather than treating a network blip as "all outlets removed").
        """
        url, grade = HPCL_PAGES[key]
        try:
            resp = self.session.get(url, accept="text/html")
        except RobotsDisallowed as exc:
            log.error("robots.txt disallows %s: %s", url, exc)
            return None
        except NetworkUnavailable as exc:
            log.warning("could not fetch %s: %s", url, exc)
            return None

        retrieved_at = utc_now_iso()
        snapshot(
            self.store,
            source="hpcl-power-page",
            identifier=key,
            content=resp.content,
            content_type=resp.headers.get("content-type", "text/html"),
            retrieved_at=retrieved_at,
            url=url,
            status=resp.status,
            method="manual-browser-capture",
            notes=f"HPCL {grade} product page",
        )
        if resp.status >= 400:
            log.warning("HPCL %s returned HTTP %s", key, resp.status)
            return None
        return parse_outlet_table(resp.text, grade)

    def _previous_parse_path(self, key: str) -> str:
        return os.path.join(self.config.out_dir, f"hpcl-{key}-latest.json")

    def run_one(self, key: str, *, do_diff: bool = True) -> Dict[str, Any]:
        current = self.fetch_and_parse(key)
        prev_path = self._previous_parse_path(key)
        previous = read_json_optional(prev_path)

        result: Dict[str, Any] = {
            "page": key,
            "grade": HPCL_PAGES[key][1],
            "retrievedAt": utc_now_iso(),
            "fetched": current is not None,
        }

        if current is None:
            # keep previous as the effective current so downstream isn't wiped
            result["rows"] = previous or []
            result["diff"] = None
            return result

        result["rows"] = current
        if do_diff and previous is not None:
            diff = diff_rows(previous, current)
            result["diff"] = {k: len(v) for k, v in diff.items()}
            result["diffDetail"] = diff
            if diff["added"] or diff["removed"] or diff["changed"]:
                log.warning(
                    "HPCL %s CHANGED: +%d -%d ~%d (review required)",
                    key, len(diff["added"]), len(diff["removed"]), len(diff["changed"]),
                )
            else:
                log.info("HPCL %s unchanged since last parse", key)
        else:
            result["diff"] = None

        # Persist current as the new baseline for next month's diff.
        write_json(prev_path, current)
        return result


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Fetch and diff HPCL poWer product pages.")
    parser.add_argument(
        "--grade",
        choices=("power99", "power100", "all"),
        default="all",
        help="Which product page(s) to process.",
    )
    parser.add_argument("--no-diff", action="store_true", help="Skip diffing against the previous parse.")
    parser.add_argument("--out", help="Combined harvest output path (default $PIPELINE_OUT_DIR/hpcl-harvest-<date>.json).")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_arg_parser().parse_args(argv)
    cfg = get_config()
    keys = list(HPCL_PAGES) if args.grade == "all" else [args.grade]

    differ = HpclDiffer()
    all_rows: List[Dict[str, Any]] = []
    reports: List[Dict[str, Any]] = []
    any_fetch = False
    for key in keys:
        report = differ.run_one(key, do_diff=not args.no_diff)
        reports.append({k: v for k, v in report.items() if k != "diffDetail"})
        all_rows.extend(report.get("rows") or [])
        any_fetch = any_fetch or report.get("fetched", False)

    harvest = {
        "source": "hpcl-power-page",
        "retrievedAt": utc_now_iso(),
        "pages": reports,
        "records": all_rows,
    }
    out_path = args.out or f"{cfg.out_dir}/hpcl-harvest-{today_str()}.json"
    write_json(out_path, harvest)

    log.info("HPCL harvest: %d rows across %d page(s) -> %s", len(all_rows), len(keys), out_path)
    print(json.dumps({"records": len(all_rows), "pages": reports}, indent=2))

    if not any_fetch:
        log.error("no HPCL page could be fetched; used previous parses only")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
