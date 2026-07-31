"""OctaneFinder data pipeline — shared infrastructure.

This module is deliberately dependency-light and import-safe: importing it never
touches the network, the filesystem (beyond reading environment variables), or a
database, and it works with the standard library alone. ``requests`` is used when
installed and transparently falls back to ``urllib`` otherwise, so every pipeline
script runs (and degrades gracefully) even in a bare interpreter.

Responsibilities (BUILD-CONTRACT / final-datasources.md §2.3):

* configuration from the environment (``PipelineConfig`` / :func:`get_config`)
* a *polite* HTTP session — identified User-Agent, per-host rate limiting,
  bounded exponential-backoff retries, and ``robots.txt`` enforcement
  (:class:`PoliteSession`)
* raw-response snapshotting to an object store with retrieval provenance
  (:func:`snapshot`, :class:`LocalObjectStore`, optional :class:`S3ObjectStore`)
* structured logging (:func:`get_logger`)

Doctrine reminders encoded here (see the decision memo, §C):

* We identify ourselves and obey ``robots.txt``. We never disable that check to
  reach WAF-protected content — deliberately bypassing an access-control
  mechanism is out of scope (IT Act ss.43/66; memo C.12).
* Every raw response is snapshotted *before* it is parsed, so provenance and the
  legal evidence locker are populated from the wire, not from a memory.
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from typing import Any, Dict, List, Mapping, Optional, Tuple

# ``requests`` is preferred (connection pooling, sane defaults) but strictly
# optional — the pipeline must run on a stdlib-only interpreter.
try:  # pragma: no cover - trivial import guard
    import requests as _requests  # type: ignore
except Exception:  # noqa: BLE001 - any import failure means "not available"
    _requests = None


__all__ = [
    "PipelineError",
    "NetworkUnavailable",
    "RobotsDisallowed",
    "PipelineConfig",
    "get_config",
    "get_logger",
    "configure_logging",
    "utc_now",
    "utc_now_iso",
    "today_str",
    "sha256_hex",
    "HttpResponse",
    "RobotsPolicy",
    "PoliteSession",
    "ObjectStore",
    "LocalObjectStore",
    "S3ObjectStore",
    "get_object_store",
    "SnapshotResult",
    "snapshot",
]

DEFAULT_USER_AGENT = (
    "OctaneFinderBot/1.0 "
    "(+https://octanefinder.example/bot; {contact}) "
    "polite-research-crawler"
)


# --------------------------------------------------------------------------- #
# Exceptions
# --------------------------------------------------------------------------- #
class PipelineError(Exception):
    """Base class for all pipeline errors."""


class NetworkUnavailable(PipelineError):
    """A request could not be completed (DNS/connection/timeout/5xx exhausted).

    Scripts catch this to *degrade gracefully* rather than crash: a source being
    unreachable is an expected, non-fatal condition for an unofficial endpoint.
    """


class RobotsDisallowed(PipelineError):
    """A URL is disallowed for our User-Agent by the host's ``robots.txt``."""


# --------------------------------------------------------------------------- #
# Logging
# --------------------------------------------------------------------------- #
_LOG_CONFIGURED = False
_LOG_LOCK = threading.Lock()


def configure_logging(level: Optional[str] = None) -> None:
    """Configure the root logger once, idempotently.

    Level is taken from the ``level`` argument, else ``$PIPELINE_LOG_LEVEL``,
    else ``INFO``.
    """
    global _LOG_CONFIGURED
    with _LOG_LOCK:
        if _LOG_CONFIGURED:
            return
        resolved = (level or os.environ.get("PIPELINE_LOG_LEVEL") or "INFO").upper()
        logging.basicConfig(
            level=getattr(logging, resolved, logging.INFO),
            format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
        _LOG_CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger namespaced under ``octanefinder.pipeline``."""
    configure_logging()
    return logging.getLogger("octanefinder.pipeline." + name)


# --------------------------------------------------------------------------- #
# Time / hashing helpers
# --------------------------------------------------------------------------- #
def utc_now() -> datetime:
    """Timezone-aware ``datetime`` in UTC."""
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    """ISO-8601 UTC timestamp with millisecond precision and a trailing ``Z``.

    Matches the shape used in ``data/stations.seed.json``
    (e.g. ``2026-07-28T00:00:00.000Z``).
    """
    return utc_now().strftime("%Y-%m-%dT%H:%M:%S.") + f"{utc_now().microsecond // 1000:03d}Z"


def today_str(when: Optional[datetime] = None) -> str:
    """``YYYY-MM-DD`` in UTC — the retrieval-date partition key for snapshots."""
    return (when or utc_now()).strftime("%Y-%m-%d")


def sha256_hex(data: bytes) -> str:
    """Hex SHA-256 digest of ``data`` (used as the snapshot content fingerprint)."""
    return hashlib.sha256(data).hexdigest()


# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
def _repo_root() -> str:
    # pipeline/common.py -> repo root is one level up from this file's dir.
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclasses.dataclass(frozen=True)
class PipelineConfig:
    """Runtime configuration, resolved from the environment.

    All fields have safe defaults so the pipeline is runnable with zero setup;
    the object store defaults to a local directory and the database is optional.
    """

    contact: str
    user_agent: str
    snapshot_dir: str
    out_dir: str
    request_timeout: float
    min_request_interval_s: float
    max_retries: int
    backoff_base_s: float
    respect_robots: bool
    database_url: Optional[str]
    s3_endpoint: Optional[str]
    s3_region: Optional[str]
    s3_bucket: Optional[str]
    s3_access_key_id: Optional[str]
    s3_secret_access_key: Optional[str]

    @property
    def has_s3(self) -> bool:
        return bool(self.s3_bucket and self.s3_endpoint)

    @property
    def has_db(self) -> bool:
        return bool(self.database_url)


_CONFIG: Optional[PipelineConfig] = None
_CONFIG_LOCK = threading.Lock()


def get_config(refresh: bool = False) -> PipelineConfig:
    """Return the process-wide :class:`PipelineConfig` singleton.

    Pass ``refresh=True`` to re-read the environment (used by tests).
    """
    global _CONFIG
    with _CONFIG_LOCK:
        if _CONFIG is not None and not refresh:
            return _CONFIG
        contact = os.environ.get("PIPELINE_CONTACT", "ops@octanefinder.example")
        user_agent = os.environ.get(
            "PIPELINE_UA", DEFAULT_USER_AGENT.format(contact=contact)
        )
        root = _repo_root()
        _CONFIG = PipelineConfig(
            contact=contact,
            user_agent=user_agent,
            snapshot_dir=os.environ.get(
                "SNAPSHOT_DIR", os.path.join(root, "pipeline", "_snapshots")
            ),
            out_dir=os.environ.get(
                "PIPELINE_OUT_DIR", os.path.join(root, "pipeline", "_out")
            ),
            request_timeout=_env_float("HTTP_TIMEOUT", 30.0),
            min_request_interval_s=_env_float("HTTP_MIN_INTERVAL", 1.0),
            max_retries=_env_int("HTTP_MAX_RETRIES", 3),
            backoff_base_s=_env_float("HTTP_BACKOFF", 2.0),
            respect_robots=_env_bool("RESPECT_ROBOTS", True),
            database_url=os.environ.get("DATABASE_URL") or None,
            s3_endpoint=os.environ.get("S3_ENDPOINT") or None,
            s3_region=os.environ.get("S3_REGION") or None,
            s3_bucket=os.environ.get("S3_BUCKET") or None,
            s3_access_key_id=os.environ.get("S3_ACCESS_KEY_ID") or None,
            s3_secret_access_key=os.environ.get("S3_SECRET_ACCESS_KEY") or None,
        )
        return _CONFIG


# --------------------------------------------------------------------------- #
# Low-level HTTP (requests with a urllib fallback)
# --------------------------------------------------------------------------- #
@dataclasses.dataclass
class HttpResponse:
    """A minimal, backend-agnostic HTTP response."""

    url: str
    status: int
    headers: Dict[str, str]
    content: bytes

    @property
    def text(self) -> str:
        charset = "utf-8"
        ctype = self.headers.get("content-type", "")
        if "charset=" in ctype:
            charset = ctype.split("charset=", 1)[1].split(";", 1)[0].strip() or "utf-8"
        try:
            return self.content.decode(charset, errors="replace")
        except LookupError:
            return self.content.decode("utf-8", errors="replace")

    def json(self) -> Any:
        return json.loads(self.text)


def _normalize_headers(raw: Mapping[str, str]) -> Dict[str, str]:
    return {str(k).lower(): str(v) for k, v in raw.items()}


def _raw_request(
    method: str,
    url: str,
    *,
    headers: Mapping[str, str],
    timeout: float,
) -> HttpResponse:
    """Perform a single HTTP request. Raises :class:`NetworkUnavailable` on failure.

    Uses ``requests`` when importable, else falls back to ``urllib``. HTTP status
    codes (including 4xx/5xx) are *returned*, not raised — retry/backoff policy is
    the caller's (:class:`PoliteSession`) responsibility.
    """
    if _requests is not None:
        try:
            resp = _requests.request(
                method, url, headers=dict(headers), timeout=timeout
            )
            return HttpResponse(
                url=resp.url,
                status=resp.status_code,
                headers=_normalize_headers(resp.headers),
                content=resp.content,
            )
        except Exception as exc:  # noqa: BLE001 - normalize to our error type
            raise NetworkUnavailable(f"{method} {url} failed: {exc}") from exc

    # Pure-stdlib fallback.
    req = urllib.request.Request(url, method=method, headers=dict(headers))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
            body = resp.read()
            return HttpResponse(
                url=resp.geturl(),
                status=getattr(resp, "status", 200) or 200,
                headers=_normalize_headers(dict(resp.headers.items())),
                content=body,
            )
    except urllib.error.HTTPError as exc:
        body = b""
        try:
            body = exc.read()
        except Exception:  # noqa: BLE001
            pass
        return HttpResponse(
            url=url,
            status=exc.code,
            headers=_normalize_headers(dict(getattr(exc, "headers", {}) or {})),
            content=body,
        )
    except Exception as exc:  # noqa: BLE001 - DNS, connection reset, timeout, ...
        raise NetworkUnavailable(f"{method} {url} failed: {exc}") from exc


# --------------------------------------------------------------------------- #
# robots.txt policy
# --------------------------------------------------------------------------- #
class RobotsPolicy:
    """Per-host ``robots.txt`` cache and allow/deny decision for our UA.

    A host with no reachable ``robots.txt`` is treated as *allow all* (the
    conventional interpretation of a 404). A ``robots.txt`` that cannot be read
    for any other reason is treated conservatively as *disallow*, so we never
    silently crawl a host whose policy we could not confirm.
    """

    def __init__(self, user_agent: str, timeout: float = 15.0) -> None:
        self._user_agent = user_agent
        self._timeout = timeout
        self._cache: Dict[str, urllib.robotparser.RobotFileParser] = {}
        self._lock = threading.Lock()
        self._log = get_logger("robots")

    def _parser_for(self, url: str) -> urllib.robotparser.RobotFileParser:
        parts = urllib.parse.urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        with self._lock:
            cached = self._cache.get(origin)
            if cached is not None:
                return cached
        rp = urllib.robotparser.RobotFileParser()
        robots_url = origin + "/robots.txt"
        try:
            resp = _raw_request(
                "GET",
                robots_url,
                headers={"User-Agent": self._user_agent},
                timeout=self._timeout,
            )
            if resp.status == 404 or resp.status == 410:
                rp.parse([])  # no rules -> allow all
            elif 200 <= resp.status < 300:
                rp.parse(resp.text.splitlines())
            else:
                # 401/403/5xx: policy unknown -> conservative disallow.
                rp.disallow_all = True  # type: ignore[attr-defined]
                self._log.warning(
                    "robots.txt for %s returned HTTP %s; treating host as disallowed",
                    origin,
                    resp.status,
                )
        except NetworkUnavailable as exc:
            rp.disallow_all = True  # type: ignore[attr-defined]
            self._log.warning("robots.txt for %s unreachable (%s); disallowing", origin, exc)
        with self._lock:
            self._cache[origin] = rp
        return rp

    def can_fetch(self, url: str) -> bool:
        rp = self._parser_for(url)
        try:
            return rp.can_fetch(self._user_agent, url)
        except Exception:  # noqa: BLE001 - defensive; robotparser edge cases
            return False

    def crawl_delay(self, url: str) -> Optional[float]:
        rp = self._parser_for(url)
        try:
            delay = rp.crawl_delay(self._user_agent)
            return float(delay) if delay is not None else None
        except Exception:  # noqa: BLE001
            return None


# --------------------------------------------------------------------------- #
# Polite HTTP session
# --------------------------------------------------------------------------- #
class PoliteSession:
    """An identified, rate-limited, robots-respecting, retrying HTTP client.

    * Sends our identified ``User-Agent`` on every request.
    * Enforces a minimum interval between requests to the *same host* (and honours
      a longer ``Crawl-delay`` from ``robots.txt`` when present).
    * Retries transient failures (connection errors, 429, 5xx) with exponential
      backoff, honouring ``Retry-After``.
    * Refuses to fetch URLs disallowed by ``robots.txt`` (raising
      :class:`RobotsDisallowed`) — this check is *never* bypassed to reach
      WAF-gated content.
    """

    def __init__(self, config: Optional[PipelineConfig] = None) -> None:
        self.config = config or get_config()
        self.robots = RobotsPolicy(self.config.user_agent, self.config.request_timeout)
        self._last_request_at: Dict[str, float] = {}
        self._lock = threading.Lock()
        self._log = get_logger("http")

    # -- rate limiting ----------------------------------------------------- #
    def _throttle(self, url: str) -> None:
        host = urllib.parse.urlsplit(url).netloc
        interval = self.config.min_request_interval_s
        crawl_delay = self.robots.crawl_delay(url) if self.config.respect_robots else None
        if crawl_delay is not None:
            interval = max(interval, crawl_delay)
        with self._lock:
            last = self._last_request_at.get(host)
            now = time.monotonic()
            if last is not None:
                wait = interval - (now - last)
                if wait > 0:
                    time.sleep(wait)
            self._last_request_at[host] = time.monotonic()

    # -- core request ------------------------------------------------------ #
    def request(
        self,
        method: str,
        url: str,
        *,
        headers: Optional[Mapping[str, str]] = None,
        accept: Optional[str] = None,
    ) -> HttpResponse:
        if self.config.respect_robots and not self.robots.can_fetch(url):
            raise RobotsDisallowed(
                f"robots.txt disallows {self.config.user_agent} from fetching {url}"
            )

        merged: Dict[str, str] = {
            "User-Agent": self.config.user_agent,
            "Accept-Language": "en-IN,en;q=0.9",
        }
        if accept:
            merged["Accept"] = accept
        if headers:
            merged.update(dict(headers))

        attempts = self.config.max_retries + 1
        last_error: Optional[Exception] = None
        for attempt in range(1, attempts + 1):
            self._throttle(url)
            try:
                resp = _raw_request(
                    method, url, headers=merged, timeout=self.config.request_timeout
                )
            except NetworkUnavailable as exc:
                last_error = exc
                self._log.warning("attempt %d/%d failed: %s", attempt, attempts, exc)
                self._sleep_backoff(attempt)
                continue

            if resp.status == 429 or 500 <= resp.status < 600:
                last_error = NetworkUnavailable(f"HTTP {resp.status} from {url}")
                self._log.warning(
                    "attempt %d/%d got HTTP %s from %s", attempt, attempts, resp.status, url
                )
                self._sleep_backoff(attempt, retry_after=resp.headers.get("retry-after"))
                continue

            return resp

        raise NetworkUnavailable(
            f"exhausted {attempts} attempts for {method} {url}: {last_error}"
        )

    def _sleep_backoff(self, attempt: int, retry_after: Optional[str] = None) -> None:
        if retry_after:
            try:
                time.sleep(min(float(retry_after), 60.0))
                return
            except ValueError:
                pass
        delay = self.config.backoff_base_s * (2 ** (attempt - 1))
        time.sleep(min(delay, 60.0))

    # -- convenience ------------------------------------------------------- #
    def get(self, url: str, *, accept: Optional[str] = None) -> HttpResponse:
        return self.request("GET", url, accept=accept)

    def get_json(self, url: str) -> Any:
        resp = self.get(url, accept="application/json")
        try:
            return resp.json()
        except json.JSONDecodeError as exc:
            raise PipelineError(f"non-JSON response from {url}: {exc}") from exc

    def get_text(self, url: str, *, accept: str = "text/html") -> str:
        return self.get(url, accept=accept).text


# --------------------------------------------------------------------------- #
# Object store + snapshotting
# --------------------------------------------------------------------------- #
class ObjectStore:
    """Abstract object store interface (``put`` returns the stored key)."""

    def put(self, key: str, data: bytes, content_type: str) -> str:  # pragma: no cover
        raise NotImplementedError

    def uri(self, key: str) -> str:  # pragma: no cover
        raise NotImplementedError


class LocalObjectStore(ObjectStore):
    """Filesystem-backed object store — the zero-config default."""

    def __init__(self, root: str) -> None:
        self.root = root

    def put(self, key: str, data: bytes, content_type: str) -> str:
        path = os.path.join(self.root, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(data)
        return key

    def uri(self, key: str) -> str:
        return "file://" + os.path.join(self.root, key)


class S3ObjectStore(ObjectStore):
    """S3/DO-Spaces-backed store. Requires ``boto3``; falls back is the caller's job.

    Constructed lazily by :func:`get_object_store` only when S3 is configured
    *and* ``boto3`` is importable, so importing this module never requires boto3.
    """

    def __init__(self, config: PipelineConfig) -> None:
        import boto3  # type: ignore  # local import: optional dependency

        self._bucket = config.s3_bucket
        self._client = boto3.client(  # type: ignore[attr-defined]
            "s3",
            endpoint_url=config.s3_endpoint,
            region_name=config.s3_region,
            aws_access_key_id=config.s3_access_key_id,
            aws_secret_access_key=config.s3_secret_access_key,
        )

    def put(self, key: str, data: bytes, content_type: str) -> str:
        self._client.put_object(
            Bucket=self._bucket, Key=key, Body=data, ContentType=content_type
        )
        return key

    def uri(self, key: str) -> str:
        return f"s3://{self._bucket}/{key}"


def get_object_store(config: Optional[PipelineConfig] = None) -> ObjectStore:
    """Return an S3 store when configured and ``boto3`` is present, else local."""
    cfg = config or get_config()
    log = get_logger("store")
    if cfg.has_s3:
        try:
            store = S3ObjectStore(cfg)
            log.info("using S3 object store at %s/%s", cfg.s3_endpoint, cfg.s3_bucket)
            return store
        except Exception as exc:  # noqa: BLE001 - missing boto3 or bad creds
            log.warning("S3 store unavailable (%s); falling back to local dir", exc)
    log.info("using local object store at %s", cfg.snapshot_dir)
    return LocalObjectStore(cfg.snapshot_dir)


_EXT_BY_CONTENT_TYPE = {
    "application/json": ".json",
    "text/html": ".html",
    "text/plain": ".txt",
    "application/xml": ".xml",
    "text/xml": ".xml",
}


@dataclasses.dataclass
class SnapshotResult:
    """The outcome of a snapshot: the stored key + its provenance sidecar."""

    key: str
    meta_key: str
    uri: str
    sha256: str
    retrieved_at: str
    bytes: int


def _ext_for(content_type: str, identifier: str) -> str:
    base = content_type.split(";", 1)[0].strip().lower()
    if base in _EXT_BY_CONTENT_TYPE:
        return _EXT_BY_CONTENT_TYPE[base]
    _, dot, tail = identifier.rpartition(".")
    return ("." + tail) if dot and len(tail) <= 5 else ".bin"


def snapshot(
    store: ObjectStore,
    source: str,
    identifier: str,
    content: bytes,
    *,
    content_type: str,
    retrieved_at: Optional[str] = None,
    url: Optional[str] = None,
    status: Optional[int] = None,
    method: Optional[str] = None,
    notes: Optional[str] = None,
) -> SnapshotResult:
    """Persist a raw response and its provenance sidecar to ``store``.

    Layout: ``<source>/<YYYY-MM-DD>/<identifier><ext>`` plus a companion
    ``...<ext>.meta.json`` carrying url, retrieval time, HTTP status, byte count,
    SHA-256 and the acquisition method. This is the *evidence locker*: snapshot
    happens before parsing so provenance is captured from the wire (memo A.6,
    final-database.md §6.6 ``data_provenance.raw_ref``).
    """
    when = retrieved_at or utc_now_iso()
    date_part = when[:10]
    ext = _ext_for(content_type, identifier)
    safe_id = _safe_component(identifier)
    key = f"{source}/{date_part}/{safe_id}{ext}"
    digest = sha256_hex(content)

    store.put(key, content, content_type)
    meta = {
        "source": source,
        "identifier": identifier,
        "url": url,
        "httpStatus": status,
        "method": method,
        "contentType": content_type,
        "retrievedAt": when,
        "sha256": digest,
        "bytes": len(content),
        "notes": notes,
    }
    meta_key = key + ".meta.json"
    store.put(
        meta_key,
        json.dumps(meta, indent=2, ensure_ascii=False).encode("utf-8"),
        "application/json",
    )
    return SnapshotResult(
        key=key,
        meta_key=meta_key,
        uri=store.uri(key),
        sha256=digest,
        retrieved_at=when,
        bytes=len(content),
    )


def _safe_component(value: str) -> str:
    """Make ``value`` safe as a single path component (no separators/spaces)."""
    out = []
    for ch in value.strip():
        if ch.isalnum() or ch in ("-", "_", "."):
            out.append(ch)
        else:
            out.append("-")
    cleaned = "".join(out).strip("-") or "item"
    return cleaned[:120]


# --------------------------------------------------------------------------- #
# Small JSON I/O helpers used across scripts
# --------------------------------------------------------------------------- #
def write_json(path: str, obj: Any) -> None:
    """Write ``obj`` as pretty UTF-8 JSON, creating parent directories."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def read_json(path: str) -> Any:
    """Read a UTF-8 JSON file (raises if missing/invalid — caller decides)."""
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def read_json_optional(path: str) -> Optional[Any]:
    """Read a JSON file, returning ``None`` when it does not exist."""
    if not os.path.exists(path):
        return None
    return read_json(path)
