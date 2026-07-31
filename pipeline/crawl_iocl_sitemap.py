"""OctaneFinder data pipeline — IOCL locator sitemap crawl (geo join).

Politely crawls ``locator.iocl.com`` via its published ``sitemap.xml`` to join the
IOCL **XP100 RO codes** (from ``iocl.com/xp100``, which has names + 6-digit RO
codes but *no* address/coordinates) to address and lat/long.

Doctrine (final-datasources.md §2.2.1, memo C.12):

* **Identified UA, rate-limited, robots-respecting.** ``locator.iocl.com``'s
  ``robots.txt`` permits outlet pages and publishes a sitemap; we honour it via
  :class:`PoliteSession`. We do **not** touch ``iocl.com/xp100`` here — it sits
  behind a Sucuri WAF and its refresh path is human-in-browser capture + RTI.
  This crawler never circumvents a WAF (IT Act ss.43/66).
* The locator has **no XP100 filter** — the XP100 card is a site-wide promo
  banner. This crawl exists solely to map RO code -> address/geo; no copy may
  claim the locator filters by fuel type (memo §0.3).
* The slug-id == RO-code equivalence is *plausible but unverified* (sprint task
  H.1). We extract candidate codes and mark the join method accordingly; on
  failure the fallback is manual geocoding of the ~220 rows.

Default behaviour is **targeted**: given the XP100 RO-code set, only the matching
outlet pages are fetched (a few hundred requests), not the full ~41.7k-page site.

Scheduling: run **monthly** (see the cron note in ``pipeline/README.md``).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

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

log = get_logger("crawl_iocl")

IOCL_SITEMAP_URL = "https://locator.iocl.com/sitemap.xml"

# A 6-digit IOCL RO code, as it appears in a locator slug/URL.
_RO_CODE_RE = re.compile(r"(?<!\d)(\d{6})(?!\d)")
# A trailing 6-digit RO code on an XP100-list line.
_XP100_LINE_RE = re.compile(r"^\s*(\d+)\s+(.*?)\s+(\d{6})\s*$")


# --------------------------------------------------------------------------- #
# XP100 official list parsing (the seed we join geo onto)
# --------------------------------------------------------------------------- #
def parse_xp100_list(text: str) -> List[Dict[str, Any]]:
    """Parse the captured ``iocl.com/xp100`` RO table text into row dicts.

    Line shape (space-joined columns):
        <serial> <Region> <State Office> SO <Div Office> <Sales Area> RSA <RO Name> <6-digit RO code>

    Column boundaries are inferred from the ``SO`` / ``DO``|``DIV`` / ``RSA``
    markers; parsing is best-effort and always yields at least ``roCode`` + a
    ``name`` (the free text before the code) so the geo join can proceed.
    """
    rows: List[Dict[str, Any]] = []
    for line in text.splitlines():
        m = _XP100_LINE_RE.match(line)
        if not m:
            continue
        serial, middle, ro_code = m.group(1), m.group(2).strip(), m.group(3)
        parsed = _split_xp100_columns(middle)
        parsed.update({"serial": int(serial), "roCode": ro_code})
        rows.append(parsed)
    log.info("parsed %d XP100 rows", len(rows))
    return rows


def _split_xp100_columns(middle: str) -> Dict[str, Any]:
    """Best-effort split of the free-text middle of an XP100 list line."""
    region_office = middle
    div_office = ""
    sales_area = ""
    name = middle

    # Sales area ends at the last " RSA " token; the RO name follows it.
    rsa = re.split(r"\bRSA\b", middle, maxsplit=1)
    if len(rsa) == 2:
        before_rsa, name = rsa[0].strip(), rsa[1].strip()
    else:
        before_rsa = middle

    # State office ends at the first " SO " token.
    so = re.split(r"\bSO\b", before_rsa, maxsplit=1)
    if len(so) == 2:
        region_office, after_so = so[0].strip(), so[1].strip()
        # Divisional office ends at " DO " / " DIV" / " Divisional Of".
        dm = re.split(r"\bDO\b|\bDIV\b|Divisional Of", after_so, maxsplit=1)
        div_office = dm[0].strip() if dm else after_so
        if len(dm) == 2:
            sales_area = dm[1].strip()
    return {
        "regionStateOffice": region_office,
        "divOffice": div_office,
        "salesArea": sales_area,
        "name": name or middle,
    }


# --------------------------------------------------------------------------- #
# Sitemap parsing
# --------------------------------------------------------------------------- #
def _localname(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def parse_sitemap(xml_text: str) -> Tuple[List[str], List[str]]:
    """Parse a sitemap or sitemap-index. Returns ``(page_urls, child_sitemaps)``.

    ``<loc>`` elements directly under a ``<sitemap>`` node are child sitemaps
    (index); those under a ``<url>`` node are page URLs. We walk the wrapper
    elements explicitly rather than relying on a parent pointer (ElementTree has
    none), which is robust to namespaces and mixed content.
    """
    pages: List[str] = []
    children: List[str] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        log.warning("sitemap XML parse error: %s", exc)
        return pages, children

    def _loc_text(wrapper: ET.Element) -> Optional[str]:
        for child in wrapper:
            if _localname(child.tag) == "loc" and child.text and child.text.strip():
                return child.text.strip()
        return None

    for wrapper in root:
        name = _localname(wrapper.tag)
        loc = _loc_text(wrapper)
        if loc is None:
            continue
        if name == "sitemap":
            children.append(loc)
        elif name == "url":
            pages.append(loc)
        else:
            # Unknown wrapper: classify by extension.
            (children if loc.lower().endswith(".xml") else pages).append(loc)
    return pages, children


def extract_ro_code_from_url(url: str) -> Optional[str]:
    """Extract a candidate 6-digit RO code from a locator outlet URL/slug (H.1)."""
    # Prefer the last path segment; fall back to the whole URL.
    tail = url.rstrip("/").rsplit("/", 1)[-1]
    m = _RO_CODE_RE.search(tail) or _RO_CODE_RE.search(url)
    return m.group(1) if m else None


# --------------------------------------------------------------------------- #
# Outlet-page geo extraction
# --------------------------------------------------------------------------- #
class _JsonLdCollector(HTMLParser):
    """Collect the text of every ``<script type="application/ld+json">`` block."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocks: List[str] = []
        self._capture = False
        self._buf: List[str] = []

    def handle_starttag(self, tag: str, attrs: Any) -> None:
        if tag == "script":
            attr = {k.lower(): (v or "").lower() for k, v in attrs}
            if attr.get("type") == "application/ld+json":
                self._capture = True
                self._buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._capture:
            self.blocks.append("".join(self._buf))
            self._capture = False
            self._buf = []

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._buf.append(data)


_META_GEO_RE = {
    "lat": re.compile(r'(?:place:location:latitude|geo\.position|latitude)["\']?\s*[:=]\s*["\']?(-?\d{1,2}\.\d+)', re.I),
    "lng": re.compile(r'(?:place:location:longitude|longitude)["\']?\s*[:=]\s*["\']?(-?\d{1,3}\.\d+)', re.I),
}


def extract_geo_from_html(html: str) -> Optional[Dict[str, Any]]:
    """Best-effort geo/address extraction from a locator outlet page.

    Tries JSON-LD (schema.org ``GasStation``/``LocalBusiness`` with ``geo`` and
    ``address``) first, then falls back to meta-tag/regex scraping. Returns
    ``None`` when nothing usable is found — the row then stays pending-geocode.
    """
    collector = _JsonLdCollector()
    try:
        collector.feed(html)
    except Exception:  # noqa: BLE001
        pass
    for block in collector.blocks:
        found = _geo_from_jsonld(block)
        if found:
            return found

    lat_m = _META_GEO_RE["lat"].search(html)
    lng_m = _META_GEO_RE["lng"].search(html)
    if lat_m and lng_m:
        try:
            return {"lat": float(lat_m.group(1)), "lng": float(lng_m.group(1)), "method": "meta-scrape"}
        except ValueError:
            return None
    return None


def _geo_from_jsonld(block: str) -> Optional[Dict[str, Any]]:
    try:
        data = json.loads(block)
    except json.JSONDecodeError:
        return None
    for node in _iter_jsonld_nodes(data):
        if not isinstance(node, dict):
            continue
        geo = node.get("geo")
        if isinstance(geo, dict):
            lat = geo.get("latitude")
            lng = geo.get("longitude")
            if lat is not None and lng is not None:
                out: Dict[str, Any] = {"method": "jsonld"}
                try:
                    out["lat"] = float(lat)
                    out["lng"] = float(lng)
                except (TypeError, ValueError):
                    continue
                addr = node.get("address")
                if isinstance(addr, dict):
                    out["address"] = addr.get("streetAddress") or ""
                    out["city"] = addr.get("addressLocality") or ""
                    out["state"] = addr.get("addressRegion") or ""
                    out["pincode"] = addr.get("postalCode") or ""
                elif isinstance(addr, str):
                    out["address"] = addr
                if node.get("telephone"):
                    out["phone"] = node["telephone"]
                return out
    return None


def _iter_jsonld_nodes(data: Any) -> Iterable[Any]:
    if isinstance(data, list):
        for item in data:
            yield from _iter_jsonld_nodes(item)
    elif isinstance(data, dict):
        yield data
        graph = data.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                yield from _iter_jsonld_nodes(item)


# --------------------------------------------------------------------------- #
# Crawler
# --------------------------------------------------------------------------- #
class IoclLocatorCrawler:
    def __init__(self, session: Optional[PoliteSession] = None) -> None:
        self.config = get_config()
        self.session = session or PoliteSession(self.config)
        self.store = get_object_store(self.config)

    def fetch_sitemap_urls(self, sitemap_url: str, *, max_children: int = 50) -> List[str]:
        """Fetch and recursively expand a sitemap into a flat list of page URLs."""
        pages: List[str] = []
        try:
            resp = self.session.get(sitemap_url, accept="application/xml")
        except RobotsDisallowed as exc:
            log.error("robots.txt disallows the sitemap: %s", exc)
            return pages
        except NetworkUnavailable as exc:
            log.warning("could not fetch sitemap %s: %s", sitemap_url, exc)
            return pages

        snapshot(
            self.store,
            source="iocl-locator-sitemap",
            identifier=sitemap_url.rsplit("/", 1)[-1] or "sitemap",
            content=resp.content,
            content_type=resp.headers.get("content-type", "application/xml"),
            retrieved_at=utc_now_iso(),
            url=sitemap_url,
            status=resp.status,
            method="api-probe",
            notes="IOCL locator sitemap",
        )
        if resp.status >= 400:
            log.warning("sitemap %s returned HTTP %s", sitemap_url, resp.status)
            return pages

        page_urls, children = parse_sitemap(resp.text)
        pages.extend(page_urls)
        for child in children[:max_children]:
            pages.extend(self.fetch_sitemap_urls(child, max_children=max_children))
        return pages

    def crawl(
        self,
        *,
        target_ro_codes: Optional[Set[str]] = None,
        limit: int = 200,
        sitemap_url: str = IOCL_SITEMAP_URL,
    ) -> Dict[str, Any]:
        """Crawl outlet pages and build a ``roCode -> geo`` join map.

        When ``target_ro_codes`` is given, only pages whose slug matches one of
        those codes are fetched (the normal XP100-join mode); otherwise the first
        ``limit`` outlet pages are crawled (discovery/QA mode).
        """
        urls = self.fetch_sitemap_urls(sitemap_url)
        log.info("sitemap yielded %d candidate page URLs", len(urls))

        matched: List[Tuple[str, str]] = []  # (ro_code, url)
        for url in urls:
            code = extract_ro_code_from_url(url)
            if code is None:
                continue
            if target_ro_codes is not None and code not in target_ro_codes:
                continue
            matched.append((code, url))
        if limit and len(matched) > limit:
            matched = matched[:limit]
        log.info("crawling %d matched outlet pages (limit=%d)", len(matched), limit)

        geo_join: Dict[str, Any] = {}
        fetched = 0
        for code, url in matched:
            geo = self._fetch_outlet_geo(code, url)
            fetched += 1
            if geo is not None:
                geo["roCode"] = code
                geo["sourceUrl"] = url
                geo_join[code] = geo

        return {
            "source": "iocl-locator-sitemap",
            "retrievedAt": utc_now_iso(),
            "sitemapPages": len(urls),
            "matchedPages": len(matched),
            "fetched": fetched,
            "joined": len(geo_join),
            "joinMethod": "slug-id==ro-code (H.1 unverified)",
            "records": geo_join,
        }

    def _fetch_outlet_geo(self, code: str, url: str) -> Optional[Dict[str, Any]]:
        try:
            resp = self.session.get(url, accept="text/html")
        except RobotsDisallowed as exc:
            log.warning("robots.txt disallows %s: %s", url, exc)
            return None
        except NetworkUnavailable as exc:
            log.warning("could not fetch outlet %s: %s", url, exc)
            return None
        snapshot(
            self.store,
            source="iocl-locator-sitemap",
            identifier=f"outlet-{code}",
            content=resp.content,
            content_type=resp.headers.get("content-type", "text/html"),
            retrieved_at=utc_now_iso(),
            url=url,
            status=resp.status,
            method="api-probe",
            notes="IOCL locator outlet page",
        )
        if resp.status >= 400:
            return None
        return extract_geo_from_html(resp.text)


def _load_target_codes(args: argparse.Namespace) -> Optional[Set[str]]:
    codes: Set[str] = set()
    if args.ro_codes:
        codes.update(c.strip() for c in args.ro_codes.split(",") if c.strip())
    if args.xp100_list:
        with open(args.xp100_list, "r", encoding="utf-8") as fh:
            for row in parse_xp100_list(fh.read()):
                codes.add(str(row["roCode"]))
    if args.xp100_json:
        data = read_json_optional(args.xp100_json)
        for row in (data or []):
            if row.get("roCode"):
                codes.add(str(row["roCode"]))
    return codes or None


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Crawl locator.iocl.com sitemap to join XP100 RO codes to geo."
    )
    parser.add_argument("--xp100-list", help="Captured iocl.com/xp100 RO list text file (targets the join).")
    parser.add_argument("--xp100-json", help="Parsed XP100 rows JSON (list of {roCode,...}).")
    parser.add_argument("--ro-codes", help="Comma-separated RO codes to target.")
    parser.add_argument("--limit", type=int, default=200, help="Max outlet pages to fetch.")
    parser.add_argument("--sitemap-url", default=IOCL_SITEMAP_URL, help="Sitemap entry point URL.")
    parser.add_argument("--out", help="Geo-join output path (default $PIPELINE_OUT_DIR/iocl-geo-<date>.json).")
    parser.add_argument(
        "--emit-xp100",
        help="Also parse --xp100-list into a rows harvest at this path (for normalize.py --iocl).",
    )
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_arg_parser().parse_args(argv)
    cfg = get_config()

    # Optionally emit the parsed XP100 rows harvest for the normaliser.
    if args.emit_xp100 and args.xp100_list:
        with open(args.xp100_list, "r", encoding="utf-8") as fh:
            rows = parse_xp100_list(fh.read())
        write_json(args.emit_xp100, {"source": "iocl-xp100-page", "records": rows})
        log.info("wrote %d XP100 rows -> %s", len(rows), args.emit_xp100)

    try:
        target = _load_target_codes(args)
    except OSError as exc:
        log.error("could not load target RO codes: %s", exc)
        return 2
    if target:
        log.info("targeting %d XP100 RO codes for geo join", len(target))
    else:
        log.info("no target codes given; discovery crawl of up to %d pages", args.limit)

    crawler = IoclLocatorCrawler()
    result = crawler.crawl(target_ro_codes=target, limit=args.limit, sitemap_url=args.sitemap_url)

    out_path = args.out or f"{cfg.out_dir}/iocl-geo-{today_str()}.json"
    # normalize.py --iocl-geo expects a bare {roCode: {...}} map.
    write_json(out_path, result["records"])
    write_json(f"{cfg.out_dir}/iocl-geo-report-{today_str()}.json",
               {k: v for k, v in result.items() if k != "records"})

    log.info(
        "IOCL geo join: %d/%d matched pages joined -> %s",
        result["joined"], result["matchedPages"], out_path,
    )
    print(json.dumps({k: v for k, v in result.items() if k != "records"}, indent=2))

    if result["sitemapPages"] == 0:
        log.error("sitemap unreachable or empty; geo join produced nothing")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
