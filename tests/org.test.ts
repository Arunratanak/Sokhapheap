import { describe, expect, it } from "vitest";
import { aggregate, suppress } from "@/lib/orgStats";
import { POST as orgPOST } from "@/app/api/org/[code]/route";

describe("organization dashboard privacy", () => {
  it("hides any group with 1–4 people, keeps 0 and ≥5", () => {
    expect([0, 1, 4, 5, 12].map(suppress)).toEqual([0, null, null, 5, 12]);
  });

  it("aggregates only counts — no individual records", () => {
    const rows = [
      ...Array(6).fill({ findrisc_band: "low", cvd_band: "<5" }),
      ...Array(3).fill({ findrisc_band: "high", cvd_band: null }),
    ];
    const s = aggregate(rows, true);
    expect(s.total).toBe(9);
    expect(s.findrisc.low).toBe(6);
    expect(s.findrisc.high).toBeNull(); // 3 → hidden
    expect(s.cvd.unknown).toBeNull();
    expect(JSON.stringify(s)).not.toMatch(/created_at|id|province/);
  });

  it("a whole organization under 5 people shows no numbers at all", () => {
    const s = aggregate([{ findrisc_band: "low", cvd_band: "<5" }], false);
    expect(s.total).toBeNull();
    expect(s.findrisc.low).toBeNull();
  });

  it("API rejects a wrong access code", async () => {
    const req = (accessCode: string) =>
      new Request("http://test/api/org/DEMO", { method: "POST", body: JSON.stringify({ accessCode }), headers: { "x-forwarded-for": "7.7.7.7" } });
    const ctx = { params: Promise.resolve({ code: "DEMO" }) };
    expect((await orgPOST(req("wrong"), ctx)).status).toBe(401);
    // Right code but no DB configured in tests → 503 (never leaks rows)
    expect((await orgPOST(req("test-org"), ctx)).status).toBe(503);
  });
});

describe("org stats — planner comparison fields", () => {
  const row = (findrisc_band: string, province: string | null = "Phnom Penh") => ({ findrisc_band, cvd_band: null, province });
  it("moderatePlus counts moderate/high/very high and is hidden under 5", () => {
    const many = [...Array(6)].map(() => row("high")).concat([...Array(4)].map(() => row("low")));
    expect(aggregate(many, false).moderatePlus).toBe(6);
    expect(aggregate([row("high"), row("moderate"), row("low")], false).moderatePlus).toBeNull();
  });
  it("mainProvince is only revealed when at least 5 screenings come from it", () => {
    const rows = [...Array(5)].map(() => row("low", "Takeo")).concat([row("low", "Kep")]);
    expect(aggregate(rows, false).mainProvince).toBe("Takeo");
    expect(aggregate([...Array(4)].map(() => row("low", "Takeo")), false).mainProvince).toBeNull();
  });
});
