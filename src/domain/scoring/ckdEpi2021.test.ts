import { describe, expect, it } from "vitest";
import { creatinineToMgdl, egfrCkdEpi2021, gfrStage } from "./ckdEpi2021";

describe("CKD-EPI 2021 creatinine equation (Inker 2021, Table 2)", () => {
  // Hand-calculated from the Table 2 coefficients (not from this code), rounded to whole numbers.
  // TODO(VERIFY): clinician to cross-check against a CKD-EPI 2021 calculator.
  const cases: [string, number, number, "male" | "female", number][] = [
    ["woman 50, Scr 0.7 (= κ, both min/max terms are 1)", 0.7, 50, "female", 105],
    ["man 60, Scr 1.0 (above κ, a2 term)", 1.0, 60, "male", 86],
    ["man 70, Scr 2.0", 2.0, 70, "male", 35],
    ["woman 40, Scr 0.5 (below κ, a1 term)", 0.5, 40, "female", 122],
  ];
  for (const [name, scr, age, sex, expected] of cases)
    it(name, () => expect(Math.round(egfrCkdEpi2021(scr, age, sex))).toBe(expected));

  it("falls with higher creatinine and older age", () => {
    expect(egfrCkdEpi2021(1.2, 50, "male")).toBeLessThan(egfrCkdEpi2021(1.0, 50, "male"));
    expect(egfrCkdEpi2021(1.0, 70, "male")).toBeLessThan(egfrCkdEpi2021(1.0, 50, "male"));
  });

  it("µmol/L → mg/dL divides by 88.4 (paper: mg/dL × 88.4 = µmol/L)", () => {
    expect(creatinineToMgdl(88.4, "µmol/L")).toBeCloseTo(1, 10);
    expect(creatinineToMgdl(1.1, "mg/dL")).toBe(1.1);
  });

  it("stages: <30 | 30–44 | 45–59 | 60–89 | ≥90", () => {
    expect([29, 30, 44, 45, 59, 60, 89, 90].map(gfrStage)).toEqual(["<30", "30-44", "30-44", "45-59", "45-59", "60-89", "60-89", ">=90"]);
  });
});
