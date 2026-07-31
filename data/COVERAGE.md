# MileageBachao — Data Coverage & Provenance

_As of 2026-07-31. **391 stations across 30 states/UTs** — assembled from the three oil companies'
own official sources, plus a small curated set of community-reported candidates. Honest by design:
every row ships as "Unverified" (availability `unknown`) until a field check-in confirms it; a
listing is not a same-day stock guarantee._

## Sources (all official-first)

1. **IndianOil XP100 official RO list — 220 outlets** (`iocl.com/xp100`, archived snapshot
   2025-03-27): RO name + RO code + state office + sales area for every XP100 outlet in the
   country. Coordinates are **city-centroid approximations** (flagged per-row in `sources[].method`);
   exact pump addresses pend field verification.
2. **BPCL locator API sweep — 9,926 outlets swept, 93 with Speed 100, 17 with legacy Speed 97**
   (`api.cep.bpcl.in` rolocators, swept 2026-07-31; 149 polite requests, adaptive grid, every raw
   response snapshotted). These rows carry **exact coordinates, full addresses, phones, pincodes,
   and per-outlet dated prices** (Speed 100 ₹169.00 as of 2026-07-31) from BPCL's own feed.
3. **HPCL official poWer outlet tables — 26 poWer 99 + 21 poWer 100 rows** (product pages,
   fetched 2026-07-28): full street addresses + phones; coordinates city-centroid. Outlets on both
   tables (e.g. Sonal Super Services, Mumbai) are one station with both grades.
4. **Curated candidates (25 rows from launch)** — locator-search leads and announcement-confirmed
   outlets, kept where not superseded; 7 were matched to the official XP100 list and upgraded with
   their official RO codes.

## Totals

- **391 stations · 30 states/UTs · 5 grades**
- By grade: **XP100 232 · Speed 100 93 · poWer 100 26 · poWer 99 26 · Speed 97 (legacy) 17**
- Top states: Delhi 44 · Uttar Pradesh 43 · Karnataka 42 · Maharashtra 36 · **Kerala 30** ·
  Rajasthan 29 · Gujarat 27 · Tamil Nadu 22 · Haryana 20 — full spread includes the North-East
  (Assam, Meghalaya, Manipur, Tripura, Mizoram, Nagaland, Arunachal Pradesh).

## Kerala (priority region, 30 stations)

- **Official XP100 (9, from IOCL's own list):** COCO Vytilla (Kochi), Madhavam Fuels + Swagat
  Pongam (Thrissur), Kerala Transport Co + Lakshmi Trading + Lakshmi Sales & Services (Kozhikode),
  Triveni Fuels (Kanhangad, **Kasaragod**), COCO Palli + COCO Anayara (Thiruvananthapuram).
- **Official BPCL Speed 100 (5, live API with exact coords + ₹169.00 price):** BP Ernakulam
  Marine Drive (Kochi), BP Thalappara NH-17 (**Malappuram**), Narayanan & Co + M Kutty Hassan
  Kutty & Co + KMR Petroleum Adivaram (Kozhikode).
- **Official HPCL poWer 99 (1):** Kumar Sales & Services, Kalamassery (also a curated candidate,
  now grade-corrected to poWer 99 per HPCL's table).
- **Candidates (locator leads, unverified):** SR Fuels Padivattom, Hijaz Kaloor, Kuzhiparambil
  Karukutty, Manakattil Attipra, KSM Kochuveli, and others — real pumps, XP100 not yet confirmed.
- **Districts still without any known 100-octane outlet:** Kollam, Kottayam, Alappuzha,
  Pathanamthitta, Idukki, Palakkad, Wayanad — an honest gap the add-a-pump flow exists to close.

## Known data-quality flags

- **Sikkim (16 BPCL rows):** BPCL's feed reports Speed 100/97 availability at outlets around
  Rangpo/Pakyong — unusually dense for the region and possibly over-inclusive flagging in the
  upstream feed. Kept with full provenance; field check-ins will settle it.
- IOCL/HPCL coordinates are city centroids, not pump entrances (flagged per row). BPCL coordinates
  are exact (from the API).
- The IOCL list snapshot is dated 2025-03-27; outlets added since won't appear until the next
  refresh (or via community reports). Quarterly RTI to each OMC remains the statutory refresh path.

## Refresh pipeline

`pipeline/poll_bpcl.py` (daily), HPCL page diff (monthly), IOCL list recapture (quarterly + RTI),
community check-ins continuously via the app. Raw sweep snapshots: scratchpad `bpcl-sweep/`.
