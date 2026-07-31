// Unit tests for src/lib/freshness.ts (BUILD-CONTRACT §6, §11 TESTS).
// Exercises gradeFreshness thresholds, reliabilityScore bounds, stationIsAllUnverified,
// relDays labels and bestFreshness ranking. Threshold constants are imported from
// @/lib/constants so the tests track the single source of truth rather than magic numbers.

import { describe, it, expect } from "vitest";
import {
  bestFreshness,
  gradeFreshness,
  relDays,
  reliabilityScore,
  stationIsAllUnverified,
} from "@/lib/freshness";
import {
  DRY_WINDOW_DAYS,
  FIELD_VERIFIED_MAX_DAYS,
  FRESH_MAX_DAYS,
  RELIABILITY_UNVERIFIED,
} from "@/lib/constants";
import { allStations, gradeMeta } from "@/lib/data";
import type { Availability, GradeName, Station, StationGrade } from "@/lib/types";

const VALID_KEYS = new Set(["fresh", "likely", "stale", "dry", "unverified"]);

function grade(
  overrides: Partial<StationGrade> & { grade?: GradeName; availability?: Availability } = {},
): StationGrade {
  return {
    grade: overrides.grade ?? "XP100",
    availability: overrides.availability ?? "in_stock",
    lastVerifiedDays:
      overrides.lastVerifiedDays === undefined ? 0 : overrides.lastVerifiedDays,
    checkins: overrides.checkins ?? 0,
    status: overrides.status ?? "field-verified",
  };
}

function station(grades: StationGrade[]): Station {
  return {
    id: "test-0001",
    slug: "test-station",
    name: "Test Station",
    brand: "IOCL",
    city: "Delhi",
    citySlug: "delhi",
    state: "Delhi",
    pincode: "110001",
    lat: 28.6,
    lng: 77.2,
    roCode: "TEST-0001",
    address: "1 Test Rd",
    phone: null,
    grades,
    price: null,
    sources: [],
    firstSeen: "2026-01-01T00:00:00.000Z",
    lastVerified: null,
  };
}

describe("gradeFreshness", () => {
  it("classifies a recently in-stock grade as fresh", () => {
    const info = gradeFreshness(grade({ availability: "in_stock", lastVerifiedDays: 4 }));
    expect(info.key).toBe("fresh");
    expect(info.label).toBe("In stock");
    expect(info.colorVar).toBe("--fresh");
  });

  it("treats the fresh boundary (== FRESH_MAX_DAYS) as fresh", () => {
    expect(
      gradeFreshness(grade({ availability: "in_stock", lastVerifiedDays: FRESH_MAX_DAYS })).key,
    ).toBe("fresh");
  });

  it("classifies just past the fresh window as likely", () => {
    const info = gradeFreshness(
      grade({ availability: "in_stock", lastVerifiedDays: FRESH_MAX_DAYS + 1 }),
    );
    expect(info.key).toBe("likely");
    expect(info.colorVar).toBe("--stale");
  });

  it("classifies within the field-verified window as likely", () => {
    expect(
      gradeFreshness(grade({ availability: "in_stock", lastVerifiedDays: FIELD_VERIFIED_MAX_DAYS }))
        .key,
    ).toBe("likely");
  });

  it("classifies beyond the field-verified window as stale", () => {
    const info = gradeFreshness(
      grade({ availability: "in_stock", lastVerifiedDays: FIELD_VERIFIED_MAX_DAYS + 10 }),
    );
    expect(info.key).toBe("stale");
    expect(info.colorVar).toBe("--stale");
  });

  it("classifies a recent out-of-stock report as dry", () => {
    const info = gradeFreshness(grade({ availability: "out_of_stock", lastVerifiedDays: 5 }));
    expect(info.key).toBe("dry");
    expect(info.label).toBe("Reported dry");
    expect(info.colorVar).toBe("--dry");
  });

  it("treats the dry boundary (== DRY_WINDOW_DAYS) as dry", () => {
    expect(
      gradeFreshness(grade({ availability: "out_of_stock", lastVerifiedDays: DRY_WINDOW_DAYS })).key,
    ).toBe("dry");
  });

  it("stops treating an old out-of-stock report as dry once past the window", () => {
    const info = gradeFreshness(
      grade({ availability: "out_of_stock", lastVerifiedDays: DRY_WINDOW_DAYS + 1 }),
    );
    expect(info.key).not.toBe("dry");
  });

  it("classifies a never-field-verified grade as unverified", () => {
    const info = gradeFreshness(grade({ lastVerifiedDays: null }));
    expect(info.key).toBe("unverified");
    expect(info.colorVar).toBe("--unknown");
  });
});

describe("reliabilityScore", () => {
  it("returns the unverified constant for a never-verified grade", () => {
    expect(reliabilityScore(grade({ lastVerifiedDays: null }))).toBe(RELIABILITY_UNVERIFIED);
  });

  it("returns 100 for a same-day, fully-confirmed grade", () => {
    expect(reliabilityScore(grade({ lastVerifiedDays: 0, checkins: 10 }))).toBe(100);
  });

  it("returns 0 for a very old, never-confirmed grade", () => {
    expect(reliabilityScore(grade({ lastVerifiedDays: 10000, checkins: 0 }))).toBe(0);
  });

  it("stays within 0..100 across a wide sweep of inputs", () => {
    for (let days = 0; days <= 400; days += 7) {
      for (const checkins of [0, 1, 3, 10, 50]) {
        const score = reliabilityScore(grade({ lastVerifiedDays: days, checkins }));
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
        expect(Number.isInteger(score)).toBe(true);
      }
    }
  });

  it("is monotonic non-increasing as staleness grows (fixed check-ins)", () => {
    const fresh = reliabilityScore(grade({ lastVerifiedDays: 2, checkins: 5 }));
    const older = reliabilityScore(grade({ lastVerifiedDays: 20, checkins: 5 }));
    expect(fresh).toBeGreaterThanOrEqual(older);
  });
});

describe("stationIsAllUnverified", () => {
  it("is true when every grade is never-field-verified", () => {
    const s = station([
      grade({ grade: "XP100", lastVerifiedDays: null }),
      grade({ grade: "poWer 100", lastVerifiedDays: null }),
    ]);
    expect(stationIsAllUnverified(s)).toBe(true);
  });

  it("is false when at least one grade has been verified", () => {
    const s = station([
      grade({ grade: "XP100", lastVerifiedDays: null }),
      grade({ grade: "poWer 100", lastVerifiedDays: 3 }),
    ]);
    expect(stationIsAllUnverified(s)).toBe(false);
  });
});

describe("relDays", () => {
  it("labels null as never field-verified", () => {
    expect(relDays(null)).toBe("never field-verified");
  });
  it("labels 0 as today", () => {
    expect(relDays(0)).toBe("today");
  });
  it("labels 1 as yesterday", () => {
    expect(relDays(1)).toBe("yesterday");
  });
  it("labels N>1 as N days ago", () => {
    expect(relDays(5)).toBe("5 days ago");
  });
});

describe("bestFreshness", () => {
  it("picks the freshest grade across the station", () => {
    const s = station([
      grade({ grade: "poWer 100", lastVerifiedDays: null }), // unverified
      grade({ grade: "XP100", availability: "in_stock", lastVerifiedDays: 2 }), // fresh
    ]);
    expect(bestFreshness(s).key).toBe("fresh");
  });

  it("respects the visibleGrades filter", () => {
    const s = station([
      grade({ grade: "poWer 100", lastVerifiedDays: null }), // unverified
      grade({ grade: "XP100", availability: "in_stock", lastVerifiedDays: 2 }), // fresh
    ]);
    expect(bestFreshness(s, ["poWer 100"]).key).toBe("unverified");
  });

  it("returns unverified when the station has no grades", () => {
    expect(bestFreshness(station([])).key).toBe("unverified");
  });
});

// Integration guard against the committed seed dataset: every real grade must yield a
// valid freshness key and an in-range reliability score.
describe("freshness over the seed dataset", () => {
  const stations = allStations();
  const gm = gradeMeta();

  it("has a non-empty seed dataset with known grades", () => {
    expect(stations.length).toBeGreaterThanOrEqual(24);
    for (const s of stations) {
      for (const g of s.grades) {
        expect(gm[g.grade]).toBeDefined();
      }
    }
  });

  it("produces valid freshness keys and bounded reliability for every seed grade", () => {
    for (const s of stations) {
      for (const g of s.grades) {
        const info = gradeFreshness(g);
        expect(VALID_KEYS.has(info.key)).toBe(true);
        expect(info.colorVar.startsWith("--")).toBe(true);
        const score = reliabilityScore(g);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
      expect(VALID_KEYS.has(bestFreshness(s).key)).toBe(true);
    }
  });
});
