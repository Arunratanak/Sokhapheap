import { describe, expect, it } from "vitest";
import { distanceExample, labExample, riskExample } from "./heroExamples";

describe("home hero examples match the real app logic", () => {
  it("slide 1 (Dara, 45): heart 4% Low, diabetes Low, BP 142/92 high reading → recheck, TB cough → get a test", () => {
    const r = riskExample();
    expect(r.screenings).toBe(4);
    expect([r.heartPercent, r.heartBand, r.heartUrgency]).toEqual([4, "<5", "low"]);
    expect(r.diabetes).toEqual({ band: "low", urgency: "low" });
    expect(r.bp).toMatchObject({ sbp: 142, dbp: 92, band: "high", urgency: "moderate", next: "results.nextSteps.bp_recheck" });
    expect(r.tb).toMatchObject({ band: "positive", urgency: "high", next: "results.nextSteps.tb_test" });
    expect(r.nearestHealthCentreKm).toBe(1.4);
  });

  it("slide 2: glucose, HbA1c and creatinine (with printed range) are within range; cholesterol 228 is above range", () => {
    expect(labExample().map((x) => [x.key, x.flag, x.direction])).toEqual([
      ["glucose", "normal", undefined],
      ["cholesterol", "outside_range", "high"],
      ["hba1c", "normal", undefined],
      ["creatinine", "normal", undefined],
    ]);
  });

  it("slide 3: Koh Kong districts from the open-data output; Thma Bang is the farthest", () => {
    const d = distanceExample();
    expect(d.bars).toHaveLength(7);
    expect(d.top).toEqual({ name: "Thma Bang", km: 27 });
    expect(d.communes).toBe(1633);
    expect(d.datasets).toBe(11);
    expect(d.peopleOver10km).toBeGreaterThan(1_000_000);
  });
});
