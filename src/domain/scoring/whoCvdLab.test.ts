import { describe, expect, it } from "vitest";
import { calculateWhoCvdLab, cholesterolColumn, toMmol, type CvdLabInput } from "./whoCvdLab";
import { AGE_GROUPS, SBP_GROUPS } from "./whoCvdTable";
import { WHO_CVD_LAB_TABLE } from "./whoCvdLabTable";

const base: CvdLabInput = { age: 72, sex: "male", smoker: false, sbp: 185, totalCholesterolMmol: 7.5, diabetes: false };

describe("WHO lab-based CVD chart, South-East Asia (PDF page 44)", () => {
  // Worked examples read by eye from the rendered chart page (docs/references/methods/who-cvd-lab/METHOD_CARD.md).
  const cases: [string, CvdLabInput, number][] = [
    ["no diabetes · men · non-smoker · 70–74 · ≥180 · ≥7", base, 35],
    ["diabetes · men · smoker · 70–74 · ≥180 · ≥7", { ...base, smoker: true, diabetes: true }, 59],
    ["no diabetes · women · non-smoker · 40–44 · <120 · <4", { ...base, sex: "female", age: 40, sbp: 110, totalCholesterolMmol: 3.5 }, 1],
    ["diabetes · women · smoker · 55–59 · 140–159 · 5–5.9", { ...base, sex: "female", smoker: true, diabetes: true, age: 57, sbp: 150, totalCholesterolMmol: 5.5 }, 20],
    ["no diabetes · men · smoker · 60–64 · 120–139 · 4–4.9", { ...base, smoker: true, age: 61, sbp: 125, totalCholesterolMmol: 4.2 }, 11],
    ["diabetes · women · non-smoker · 65–69 · 160–179 · 6–6.9", { ...base, sex: "female", diabetes: true, age: 66, sbp: 170, totalCholesterolMmol: 6.4 }, 22],
    ["no diabetes · women · smoker · 50–54 · ≥180 · <4", { ...base, sex: "female", smoker: true, age: 50, sbp: 200, totalCholesterolMmol: 3.9 }, 12],
    ["diabetes · men · non-smoker · 45–49 · <120 · ≥7", { ...base, diabetes: true, age: 49, sbp: 119, totalCholesterolMmol: 7 }, 6],
  ];
  for (const [name, input, expected] of cases)
    it(name, () => {
      const r = calculateWhoCvdLab(input);
      expect(r.available && r.riskPercent).toBe(expected);
    });

  it("has exactly 1400 cells, all between 0 and 100", () => {
    const cells = Object.values(WHO_CVD_LAB_TABLE).flatMap((s) => Object.values(s).flatMap((k) => Object.values(k).flatMap((a) => Object.values(a).flatMap((r) => Object.values(r).flat()))));
    expect(cells).toHaveLength(1400);
    expect(cells.every((v) => Number.isInteger(v) && v >= 0 && v <= 100)).toBe(true);
  });

  it("risk never falls with older age, higher SBP, higher cholesterol, smoking or diabetes (extraction sanity check)", () => {
    for (const dm of ["noDiabetes", "diabetes"] as const)
      for (const sex of ["male", "female"] as const)
        for (const smk of ["nonSmoker", "smoker"] as const)
          for (const [ai, age] of AGE_GROUPS.entries())
            for (const [si, sbp] of SBP_GROUPS.entries())
              for (let c = 0; c < 5; c++) {
                const v = WHO_CVD_LAB_TABLE[dm][sex][smk][age][sbp][c];
                if (c > 0) expect(v).toBeGreaterThanOrEqual(WHO_CVD_LAB_TABLE[dm][sex][smk][age][sbp][c - 1]);
                if (si > 0) expect(v).toBeGreaterThanOrEqual(WHO_CVD_LAB_TABLE[dm][sex][smk][age][SBP_GROUPS[si - 1]][c]);
                if (ai > 0) expect(v).toBeGreaterThanOrEqual(WHO_CVD_LAB_TABLE[dm][sex][smk][AGE_GROUPS[ai - 1]][sbp][c]);
                if (smk === "smoker") expect(v).toBeGreaterThanOrEqual(WHO_CVD_LAB_TABLE[dm][sex].nonSmoker[age][sbp][c]);
                if (dm === "diabetes") expect(v).toBeGreaterThanOrEqual(WHO_CVD_LAB_TABLE.noDiabetes[sex][smk][age][sbp][c]);
              }
  });

  it("cholesterol columns: <4 | 4–4.9 | 5–5.9 | 6–6.9 | ≥7 (half-open between printed limits)", () => {
    expect([3.99, 4, 4.95, 5, 5.99, 6, 6.99, 7, 9].map((v) => cholesterolColumn(v).group)).toEqual(["<4", "4-4.9", "4-4.9", "5-5.9", "5-5.9", "6-6.9", "6-6.9", ">=7", ">=7"]);
  });

  it("mg/dL → mmol/L uses the source factor 0.02586 (source example: 200 mg/dL = 5.172 mmol/L)", () => {
    expect(toMmol(200, "mg/dL")).toBeCloseTo(5.172, 3);
    expect(toMmol(5.2, "mmol/L")).toBe(5.2);
    expect(cholesterolColumn(toMmol(193, "mg/dL")).group).toBe("4-4.9"); // 4.99 mmol/L
  });

  it("is unavailable when age, blood pressure, diabetes status or cholesterol is missing", () => {
    expect(calculateWhoCvdLab({ ...base, age: 39 })).toEqual({ available: false, reason: "age_out_of_range" });
    expect(calculateWhoCvdLab({ ...base, age: 75 })).toEqual({ available: false, reason: "age_out_of_range" });
    expect(calculateWhoCvdLab({ ...base, sbp: null })).toEqual({ available: false, reason: "bp_unknown" });
    expect(calculateWhoCvdLab({ ...base, diabetes: null })).toEqual({ available: false, reason: "diabetes_unknown" });
    expect(calculateWhoCvdLab({ ...base, totalCholesterolMmol: null })).toEqual({ available: false, reason: "cholesterol_unknown" });
    expect(calculateWhoCvdLab({ ...base, totalCholesterolMmol: 0 })).toEqual({ available: false, reason: "cholesterol_unknown" });
  });

  it("reports the chart groups it used", () => {
    expect(calculateWhoCvdLab(base)).toMatchObject({ band: ">=30", groups: { age: "70-74", sbp: ">=180", cholesterol: ">=7", diabetes: false } });
  });
});
