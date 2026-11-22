import { describe, expect, it } from "vitest";
import { ageGroup, bmiColumn, calculateWhoCvd, cvdBand, sbpGroup } from "./whoCvd";
import { AGE_GROUPS, SBP_GROUPS, WHO_CVD_TABLE } from "./whoCvdTable";

describe("WHO CVD — 5+ cases checked against the chart (HEARTS 2020, page 65, South-East Asia)", () => {
  // Expected values read from the rendered chart page, cell by cell.
  const cases = [
    { input: { age: 72, sex: "male", smoker: false, sbp: 185, bmi: 19 }, pct: 26, band: "20-30" },
    { input: { age: 74, sex: "male", smoker: true, sbp: 200, bmi: 36 }, pct: 44, band: ">=30" },
    { input: { age: 66, sex: "female", smoker: false, sbp: 130, bmi: 18.5 }, pct: 9, band: "5-10" },
    { input: { age: 40, sex: "male", smoker: false, sbp: 110, bmi: 19.9 }, pct: 1, band: "<5" },
    { input: { age: 62, sex: "female", smoker: true, sbp: 170, bmi: 32 }, pct: 20, band: "20-30" },
    { input: { age: 52, sex: "male", smoker: true, sbp: 180, bmi: 27 }, pct: 20, band: "20-30" },
    { input: { age: 47, sex: "female", smoker: false, sbp: 119, bmi: 40 }, pct: 2, band: "<5" },
  ] as const;

  for (const c of cases)
    it(`${c.input.sex} ${c.input.smoker ? "smoker" : "non-smoker"} age ${c.input.age}, SBP ${c.input.sbp}, BMI ${c.input.bmi} → ${c.pct}%`, () => {
      const r = calculateWhoCvd({ ...c.input });
      expect(r).toMatchObject({ available: true, riskPercent: c.pct, band: c.band });
    });
});

describe("WHO CVD — grouping and availability", () => {
  it("age groups 40–74 only", () => {
    expect([39, 40, 44, 45, 74, 74.9, 75].map(ageGroup)).toEqual([null, "40-44", "40-44", "45-49", "70-74", "70-74", null]);
  });

  it("SBP rows and BMI columns at their boundaries", () => {
    expect([119, 120, 139, 140, 159, 160, 179, 180].map(sbpGroup)).toEqual(
      ["<120", "120-139", "120-139", "140-159", "140-159", "160-179", "160-179", ">=180"],
    );
    expect([19.9, 20, 24.9, 25, 29.9, 30, 34.9, 35].map(bmiColumn)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });

  it("risk bands follow the chart legend", () => {
    expect([4, 5, 9, 10, 19, 20, 29, 30].map(cvdBand)).toEqual(["<5", "5-10", "5-10", "10-20", "10-20", "20-30", "20-30", ">=30"]);
  });

  it("returns unavailable with a reason instead of guessing", () => {
    const p = { sex: "male", smoker: false, bmi: 22 } as const;
    expect(calculateWhoCvd({ ...p, age: 39, sbp: 130 })).toEqual({ available: false, reason: "age_out_of_range" });
    expect(calculateWhoCvd({ ...p, age: 75, sbp: 130 })).toEqual({ available: false, reason: "age_out_of_range" });
    expect(calculateWhoCvd({ ...p, age: 50, sbp: null })).toEqual({ available: false, reason: "bp_unknown" });
    expect(calculateWhoCvd({ ...p, age: 50, sbp: 130, bmi: null })).toEqual({ available: false, reason: "bmi_unknown" });
  });
});

describe("WHO CVD table integrity (extraction checks)", () => {
  it("has 700 cells (2 sexes × 2 smoking × 7 ages × 5 SBP × 5 BMI)", () => {
    let n = 0;
    for (const sex of ["male", "female"] as const)
      for (const s of ["smoker", "nonSmoker"] as const)
        for (const a of AGE_GROUPS) for (const b of SBP_GROUPS) n += WHO_CVD_TABLE[sex][s][a][b].length;
    expect(n).toBe(700);
  });

  it("risk never decreases with older age, higher SBP or smoking", () => {
    for (const sex of ["male", "female"] as const)
      for (const s of ["smoker", "nonSmoker"] as const)
        for (let ai = 0; ai < AGE_GROUPS.length; ai++)
          for (let si = 0; si < SBP_GROUPS.length; si++)
            for (let c = 0; c < 5; c++) {
              const v = WHO_CVD_TABLE[sex][s][AGE_GROUPS[ai]][SBP_GROUPS[si]][c];
              if (ai > 0) expect(v).toBeGreaterThanOrEqual(WHO_CVD_TABLE[sex][s][AGE_GROUPS[ai - 1]][SBP_GROUPS[si]][c]);
              if (si > 0) expect(v).toBeGreaterThanOrEqual(WHO_CVD_TABLE[sex][s][AGE_GROUPS[ai]][SBP_GROUPS[si - 1]][c]);
              if (s === "smoker") expect(v).toBeGreaterThanOrEqual(WHO_CVD_TABLE[sex].nonSmoker[AGE_GROUPS[ai]][SBP_GROUPS[si]][c]);
            }
  });
});
