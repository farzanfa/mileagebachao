// Integration test for the GET /api/v1/stations route handler (BUILD-CONTRACT §7, §11 TESTS).
// Calls the exported handler directly with a Request and asserts the response envelope over the
// committed seed dataset — no database and no secrets required (the query layer falls back to
// data/stations.seed.json when DATABASE_URL is unset).

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/v1/stations/route";
import type { ApiOk, Station } from "@/lib/types";

async function call(query = ""): Promise<{ status: number; body: ApiOk<Station[]> }> {
  const res = await GET(new Request(`http://localhost/api/v1/stations${query}`));
  const body = (await res.json()) as ApiOk<Station[]>;
  return { status: res.status, body };
}

describe("GET /api/v1/stations (seed fallback, no DB)", () => {
  it("returns the { data, meta } envelope", async () => {
    const { status, body } = await call("?limit=5");
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(5);
    expect(body.meta).toBeDefined();
    expect(body.meta?.limit).toBe(5);
    expect(body.meta?.offset).toBe(0);
    expect(typeof body.meta?.total).toBe("number");
    expect(body.meta?.total).toBeGreaterThanOrEqual(24);
  });

  it("returns rows in the Station shape", async () => {
    const { body } = await call("?limit=3");
    for (const s of body.data) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.slug).toBe("string");
      expect(["IOCL", "HPCL", "BPCL"]).toContain(s.brand);
      expect(Array.isArray(s.grades)).toBe(true);
      expect(s.grades.length).toBeGreaterThan(0);
    }
  });

  it("filters by brand", async () => {
    const { body } = await call("?brand=BPCL&limit=50");
    expect(body.data.length).toBeGreaterThan(0);
    for (const s of body.data) expect(s.brand).toBe("BPCL");
  });

  it("filters by free-text query (city)", async () => {
    const { body } = await call("?q=kochi&limit=50");
    expect(body.data.length).toBeGreaterThan(0);
    for (const s of body.data) {
      const hay = `${s.city} ${s.state} ${s.pincode} ${s.address} ${s.name}`.toLowerCase();
      expect(hay).toContain("kochi");
    }
  });

  it("only Speed 100 carries an authoritative price in the seed", async () => {
    const { body } = await call("?limit=50");
    for (const s of body.data) {
      if (s.price) expect(s.price.grade).toBe("Speed 100");
    }
  });

  it("paginates: offset advances the window", async () => {
    const page1 = await call("?limit=2&offset=0");
    const page2 = await call("?limit=2&offset=2");
    const ids1 = page1.body.data.map((s) => s.id);
    const ids2 = page2.body.data.map((s) => s.id);
    for (const id of ids2) expect(ids1).not.toContain(id);
  });
});
