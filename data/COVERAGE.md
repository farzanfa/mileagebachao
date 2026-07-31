# MileageBachao — Data Coverage & Provenance

_As of 2026-07-31. **345 pumps on the map, across 29 states/UTs — every single pin has (a) its
fuel grade confirmed by an official oil-company source AND (b) exact coordinates from that
company's own locator page or API.** No assumed grades, no approximate pins. A further 37
outlets sit in `data/pending-stations.json` (never rendered) awaiting exact verification._

## The strict rule (why you can trust a pin)

A pump appears on the map only when BOTH are true:

1. **Grade is official** — the outlet is on IndianOil's published XP100 RO list, HPCL's poWer
   99/100 outlet tables, or carries the grade flag in BPCL's own locator API.
2. **Coordinates are official** — read from that OMC's locator page for that exact outlet
   (locator.iocl.com / petrolpump.hpretail.in, which publish per-outlet GPS) or from BPCL's API.

Everything that fails either test — including every "probably has XP100" candidate — is in
pending, not on the map.

## On-map totals

- **345 pumps · 29 states/UTs**
- By grade: **XP100 197 · Speed 100 92 · Speed 97 (legacy) 17 · poWer 99 22 · poWer 100 20**
- Top states: Delhi 40 · UP 33 · Karnataka 29 · Rajasthan 27 · Maharashtra 23 · Gujarat 22 ·
  Haryana 14 · **Kerala 15** · Tamil Nadu 12
- All rows ship availability **"unknown" / Unverified** — a listing is not a same-day stock
  guarantee; community check-ins add freshness.

## Kerala (15 exact pumps)

- **XP100 (8, IOCL official list + locator GPS):** COCO Vytilla (Kochi), Kerala Transport Co
  (Kozhikode), Madhavam Fuels + Swagat Pongam (Thrissur), Lakshmi Trading + Lakshmi Sales &
  Services (Kozhikode), COCO Pallipuram + COCO Anayara (Thiruvananthapuram).
- **poWer 99 (1, HPCL official table + locator GPS):** Kumar Sales & Services (Kalamassery).
- **Speed 100 (5, BPCL API with GPS + live ₹169.00 price):** BP Ernakulam Marine Drive (Kochi),
  BP Thalappara NH-17 (Malappuram), Narayanan & Co + M Kutty Hassan Kutty & Co + KMR Petroleum
  (Kozhikode).
- **XP100 also:** Triveni Fuels (Chempanthotty, Kannur — the official 'Kanhangad RSA' outlet, hand-verified).
- In pending: remaining outlets whose
  exact locator pages didn't match yet; plus all former locator-search candidates (grade unproven).

## Pending (97, hidden from the map)

- 57 official IOCL XP100 outlets + 21 official HPCL poWer outlets whose exact locator pages
  didn't name-match yet (spelling/slug gaps — recoverable with manual matching or RTI addresses).
- All former "candidate" pumps whose premium grade was inferred from locator searches — per the
  no-assumed-pumps rule they stay hidden until verified.
- A few join-ambiguity rows (two official entries matching one locator page).

## Known flags

- **Sikkim (16 BPCL rows):** BPCL's own feed flags Speed 100/97 around Rangpo/Pakyong —
  unusually dense; kept because it is the company's own data; check-ins will settle it.
- The IOCL XP100 list snapshot is dated 2025-03-27; newer outlets appear via community reports or
  the next refresh. Quarterly RTI to each OMC remains the statutory refresh path.

## Refresh pipeline

`pipeline/poll_bpcl.py` (daily), HPCL page diff (monthly), IOCL list + locator join (quarterly +
RTI), community check-ins continuously. Raw snapshots: BPCL sweep + locator pages, scratchpad.
