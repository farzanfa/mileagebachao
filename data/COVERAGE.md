# OctaneFinder — Data Coverage & Provenance

_As of 2026-07-31. This dataset is seeded into the app (`data/stations.seed.json`) and is honest about
what is **confirmed** vs **candidate**. It is deliberately NOT presented as a complete census — the whole
reason the product exists is that no complete, current, per-outlet list of 100-octane pumps is published
anywhere. Community field-verification (check-ins) is what turns "listed" into "confirmed in stock"._

## Totals

- **27 outlets** across **Kerala (22)** and **Karnataka / Bengaluru (5)**.
- By brand/grade: **IOCL XP100 — 19**, **HPCL poWer 100 — 5** (candidate), **BPCL Speed 100 — 1**.
- Every outlet ships as **"Unverified"** (availability `unknown`, no field check-in yet). This is truthful:
  we have a listing or an announcement, not a same-day confirmation of stock.

## Confidence tiers (encoded in each row's `sources[].method`)

1. **Confirmed (official announcement).** The grade's availability was publicly announced by the OMC or
   widely reported. Kerala: IndianOil **Vytilla** and **Thevara** (Kochi) — XP100 launch confirmed by
   IndianOil Kerala. Bengaluru: **Bowring/St Mark's Rd, COCO ITI/KR Puram, Patel/JP Nagar, Sowbhagya/HSR**
   (XP100 launch outlets). **BP Cubbon Park** (Speed 100 launch).
2. **Candidate (official locator).** A real IndianOil/HPCL retail outlet pulled from the company locator
   (`locator.iocl.com`, `petrolpump.hpretail.in`), **with its real RO code**, in a city where the premium
   grade is offered — but the locator has **no fuel-grade filter**, so XP100 / poWer 100 availability at that
   specific pump is **not yet confirmed**. These are strong leads to field-verify, not guarantees.

> Because of tier 2, the app must never assert "sells XP100" as fact for a candidate — the UI shows the
> "Unverified — official listing, not field-confirmed" badge, which is exactly correct here.

## Kerala breakdown (the priority region)

| District | Outlets | Notes |
| --- | --- | --- |
| Ernakulam (Kochi) | 8 | Vytilla + Thevara **confirmed XP100**; SR Fuels (Padivattom), Hijaz (Kaloor), Kuzhiparambil (Karukutty) candidates; HPCL Falcon Fuels, Kumar S&S (Kalamassery), PM Louis Sons (Aluva), Smart Fuels (Kothamangalam) |
| Thiruvananthapuram | 3 | Manakattil (Attipra), COCO Anayara, KSM (Kochuveli) — candidates |
| Kozhikode / Calicut | 6 | Calicut Petrols, Kerala Transport Co, P P Sons, Kokkallur (Balussery), + Mahe — candidates |
| Kannur | 2 | K C Petroleum (Kodiyeri), Kallikkandy (Thrippangottur) — candidates |
| Thrissur | 1 | HPCL Unique Petroleum (Chungam) — candidate |
| Kollam, Kottayam, Alappuzha, Palakkad, Malappuram, Wayanad, Idukki, Pathanamthitta, Kasaragod | 0 | Not yet harvested — **coverage gap to fill** |

Coordinates are **locality-centroid approximations** (flagged in each row's `method`), not surveyed pump
entrances — precise geocoding is a field-verification task.

## Beyond Kerala

The app also confirms XP100 is sold in these launch cities (specific outlets still to be harvested):
Delhi, Gurgaon, Noida, Agra, Jaipur, Chandigarh, Ludhiana, Mumbai, Pune, Ahmedabad, Bengaluru, Chennai,
Hyderabad, Kolkata, Bhubaneswar. **BPCL Speed 100** is in ~8 cities only (Bengaluru confirmed;
~₹169/L). **HPCL poWer 100** availability is thinner and less publicly enumerated.

## A live competitor to know about

**octanemap.com** already bills itself as "the definitive map of every petrol pump in India that sells
premium high-octane fuel" (XP95/XP100, poWer 95/99/100, Speed 95/97, Jio-bp ACTIVE ~97 RON, Shell
V-Power). Worth studying for coverage and gaps — and a reminder that OctaneFinder's edge must be
**freshness + ethanol-free focus + verification**, not merely a static list.

## How to expand this dataset (next harvest — needs deep web fetch / the pipeline)

1. **Team-BHP master thread** (forum/230198) — the largest crowd list; extract outlets per city.
2. **octanemap.com** — cross-check its outlet set (respect its terms; don't scrape wholesale).
3. **IOCL / HPCL locator crawl** — `pipeline/crawl_iocl_sitemap.py` joins RO code → address/coords at scale.
4. **BPCL locator API** — `pipeline/poll_bpcl.py` returns per-outlet `fuelAvailable[]` incl. "SPEED 100".
5. **RTI to each OMC CPIO** — the statutory way to compel the authoritative XP100/poWer 100/Speed 100
   outlet lists (₹10, 30-day clock). This is the only path to a truly complete, defensible list.
6. **Field verification** — the app's own check-ins convert candidates → confirmed and keep them fresh.

_Sources for the current rows: IndianOil `locator.iocl.com`, HPCL `petrolpump.hpretail.in`, IndianOil
Kerala announcements, BPCL Retail (Speed 100 launch), Team-BHP, and press coverage. Retrieved 2026-07-31._
