// Unit tests for src/lib/geo.ts (BUILD-CONTRACT §6, §11 TESTS).
// Covers haversineKm against known city-pair distances and invariants, plus toSlug
// normalization rules (diacritic folding, punctuation collapse, trimming).

import { describe, it, expect } from "vitest";
import { haversineKm, toSlug } from "@/lib/geo";
import type { Coord } from "@/lib/types";

// Well-known city centres (decimal degrees).
const DELHI: Coord = { lat: 28.6139, lng: 77.209 };
const MUMBAI: Coord = { lat: 19.076, lng: 72.8777 };
const BENGALURU: Coord = { lat: 12.9756, lng: 77.6068 };
const CHENNAI: Coord = { lat: 13.0418, lng: 80.2341 };

describe("haversineKm", () => {
  it("returns ~1150 km for Delhi <-> Mumbai", () => {
    const d = haversineKm(DELHI, MUMBAI);
    // True great-circle distance is ~1148 km; assert a tight ±15 km band.
    expect(d).toBeGreaterThan(1130);
    expect(d).toBeLessThan(1165);
  });

  it("returns ~285 km for Bengaluru <-> Chennai", () => {
    const d = haversineKm(BENGALURU, CHENNAI);
    expect(d).toBeGreaterThan(270);
    expect(d).toBeLessThan(300);
  });

  it("is zero for identical coordinates", () => {
    expect(haversineKm(DELHI, DELHI)).toBeCloseTo(0, 6);
  });

  it("approximates 111 km per degree of latitude", () => {
    const d = haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeCloseTo(111.19, 1);
  });

  it("is symmetric: d(a,b) === d(b,a)", () => {
    expect(haversineKm(DELHI, MUMBAI)).toBeCloseTo(haversineKm(MUMBAI, DELHI), 9);
  });

  it("is always non-negative", () => {
    expect(haversineKm(DELHI, CHENNAI)).toBeGreaterThanOrEqual(0);
    expect(haversineKm(MUMBAI, MUMBAI)).toBeGreaterThanOrEqual(0);
  });
});

describe("toSlug", () => {
  it("lowercases and hyphenates words and punctuation", () => {
    expect(toSlug("Connaught Place, IndianOil")).toBe("connaught-place-indianoil");
  });

  it("folds common diacritics to ASCII", () => {
    expect(toSlug("Café Résumé")).toBe("cafe-resume");
  });

  it("collapses runs of separators into a single hyphen", () => {
    expect(toSlug("A   ---  B")).toBe("a-b");
  });

  it("trims leading and trailing separators", () => {
    expect(toSlug("  --Delhi--  ")).toBe("delhi");
  });

  it("preserves digits", () => {
    expect(toSlug("XP100 Outlet 42")).toBe("xp100-outlet-42");
  });

  it("returns an empty string for input with no alphanumerics", () => {
    expect(toSlug("--- , . ---")).toBe("");
  });

  it("is idempotent on an already-slugged value", () => {
    const once = toSlug("HPCL poWer 100, MG Road");
    expect(toSlug(once)).toBe(once);
  });
});
