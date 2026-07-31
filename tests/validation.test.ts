// Unit tests for src/lib/validation.ts (BUILD-CONTRACT §6/§7, §11 TESTS).
// Each exported zod schema is checked to accept a valid payload (with correct
// coercion/transforms) and to reject invalid input. Query schemas are lenient on
// unknown grade/brand CSV tokens (dropped, not rejected) but strict on scalars.

import { describe, it, expect } from "vitest";
import {
  adminDecisionSchema,
  checkinSchema,
  correctionSchema,
  imagePresignSchema,
  nearbyQuerySchema,
  stationsQuerySchema,
} from "@/lib/validation";

describe("stationsQuerySchema", () => {
  it("accepts an empty query (all fields optional)", () => {
    const r = stationsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("parses valid params and transforms CSV/flags", () => {
    const r = stationsQuerySchema.safeParse({
      q: "delhi",
      grade: "XP100,Speed 100",
      brand: "IOCL",
      e0Only: "true",
      sort: "fresh",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.q).toBe("delhi");
      expect(r.data.grade).toEqual(["XP100", "Speed 100"]);
      expect(r.data.brand).toEqual(["IOCL"]);
      expect(r.data.e0Only).toBe(true);
      expect(r.data.sort).toBe("fresh");
    }
  });

  it("drops unknown grade tokens rather than rejecting", () => {
    const r = stationsQuerySchema.safeParse({ grade: "XP100,NotAGrade,Speed 100" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.grade).toEqual(["XP100", "Speed 100"]);
  });

  it("coerces e0Only=1 to boolean true", () => {
    const r = stationsQuerySchema.safeParse({ e0Only: "1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.e0Only).toBe(true);
  });

  it("rejects an invalid sort value", () => {
    expect(stationsQuerySchema.safeParse({ sort: "sideways" }).success).toBe(false);
  });

  it("rejects a non-boolean-ish e0Only value", () => {
    expect(stationsQuerySchema.safeParse({ e0Only: "maybe" }).success).toBe(false);
  });
});

describe("nearbyQuerySchema", () => {
  it("accepts and coerces numeric lat/lng/radius", () => {
    const r = nearbyQuerySchema.safeParse({ lat: "28.6", lng: "77.2", radiusKm: "25" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.lat).toBeCloseTo(28.6, 5);
      expect(r.data.lng).toBeCloseTo(77.2, 5);
      expect(r.data.radiusKm).toBe(25);
    }
  });

  it("requires lat and lng", () => {
    expect(nearbyQuerySchema.safeParse({ radiusKm: "10" }).success).toBe(false);
    expect(nearbyQuerySchema.safeParse({ lat: "28.6" }).success).toBe(false);
  });

  it("rejects out-of-range latitude", () => {
    expect(nearbyQuerySchema.safeParse({ lat: "200", lng: "77.2" }).success).toBe(false);
  });

  it("rejects out-of-range longitude", () => {
    expect(nearbyQuerySchema.safeParse({ lat: "28.6", lng: "400" }).success).toBe(false);
  });

  it("rejects a radius beyond the maximum", () => {
    expect(nearbyQuerySchema.safeParse({ lat: "28.6", lng: "77.2", radiusKm: "9999" }).success).toBe(
      false,
    );
  });

  it("allows radiusKm to be omitted", () => {
    const r = nearbyQuerySchema.safeParse({ lat: "28.6", lng: "77.2" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.radiusKm).toBeUndefined();
  });
});

describe("correctionSchema", () => {
  it("accepts a minimal valid correction", () => {
    const r = correctionSchema.safeParse({ stationId: "iocl-dl-0421", field: "phone", value: "+911100000000" });
    expect(r.success).toBe(true);
  });

  it("accepts optional note and contact", () => {
    const r = correctionSchema.safeParse({
      stationId: "iocl-dl-0421",
      field: "address",
      value: "New address",
      note: "Saw the board changed",
      contact: "user@example.com",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty stationId", () => {
    expect(correctionSchema.safeParse({ stationId: "", field: "phone", value: "x" }).success).toBe(
      false,
    );
  });

  it("rejects a missing value", () => {
    expect(correctionSchema.safeParse({ stationId: "s1", field: "phone" }).success).toBe(false);
  });

  it("rejects an over-long value", () => {
    const long = "x".repeat(501);
    expect(
      correctionSchema.safeParse({ stationId: "s1", field: "phone", value: long }).success,
    ).toBe(false);
  });
});

describe("checkinSchema", () => {
  it("accepts a valid check-in", () => {
    const r = checkinSchema.safeParse({ stationId: "bpcl-dl-1187", grade: "Speed 100", result: "in_stock" });
    expect(r.success).toBe(true);
  });

  it("accepts optional lat/lng within range", () => {
    const r = checkinSchema.safeParse({
      stationId: "bpcl-dl-1187",
      grade: "Speed 100",
      result: "out_of_stock",
      lat: 28.6,
      lng: 77.2,
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown grade", () => {
    expect(
      checkinSchema.safeParse({ stationId: "s1", grade: "Speed 95", result: "in_stock" }).success,
    ).toBe(false);
  });

  it("rejects an unknown result", () => {
    expect(
      checkinSchema.safeParse({ stationId: "s1", grade: "XP100", result: "maybe" }).success,
    ).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    expect(
      checkinSchema.safeParse({ stationId: "s1", grade: "XP100", result: "in_stock", lat: 999 })
        .success,
    ).toBe(false);
  });
});

describe("imagePresignSchema", () => {
  it("accepts a supported content type", () => {
    const r = imagePresignSchema.safeParse({ stationId: "s1", contentType: "image/jpeg" });
    expect(r.success).toBe(true);
  });

  it("rejects an unsupported content type", () => {
    expect(imagePresignSchema.safeParse({ stationId: "s1", contentType: "image/gif" }).success).toBe(
      false,
    );
  });

  it("rejects a missing stationId", () => {
    expect(imagePresignSchema.safeParse({ contentType: "image/png" }).success).toBe(false);
  });
});

describe("adminDecisionSchema", () => {
  it("accepts approve and reject", () => {
    expect(adminDecisionSchema.safeParse({ decision: "approve" }).success).toBe(true);
    expect(adminDecisionSchema.safeParse({ decision: "reject", note: "dup" }).success).toBe(true);
  });

  it("rejects an unknown decision", () => {
    expect(adminDecisionSchema.safeParse({ decision: "defer" }).success).toBe(false);
  });
});
