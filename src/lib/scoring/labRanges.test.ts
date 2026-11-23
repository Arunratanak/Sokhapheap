import { describe, expect, it } from "vitest";
import { evaluateLabValue, LAB_RANGES, matchTest, toCanonical, type ExtractedLabValue } from "./labRanges";

const v = (o: Partial<ExtractedLabValue>): ExtractedLabValue => ({
  test_name: "Fasting Blood Sugar", value: 90, unit: "mg/dL",
  printed_range_low: null, printed_range_high: null, confidence: 0.95, ...o,
});

describe("lab test name matching", () => {
  it("matches common printed names and aliases", () => {
    expect(matchTest("Fasting Blood Sugar (FBS)")).toBe("fasting_glucose");
    expect(matchTest("FBS")).toBe("fasting_glucose");
    expect(matchTest("Glucose")).toBe("random_glucose");
    expect(matchTest("HbA1c")).toBe("hba1c");
    expect(matchTest("Total Cholesterol")).toBe("total_cholesterol");
    expect(matchTest("LDL-Cholesterol")).toBe("ldl");
    expect(matchTest("HDL Cholesterol")).toBe("hdl");
    expect(matchTest("Triglycerides")).toBe("triglycerides");
    expect(matchTest("Creatinine (serum)")).toBe("creatinine");
    expect(matchTest("Hemoglobin")).toBeNull();
    expect(matchTest("")).toBeNull();
  });
});

describe("unit conversion (mg/dL ↔ mmol/L)", () => {
  it("glucose 5.5 mmol/L ≈ 99.1 mg/dL", () => expect(toCanonical("fasting_glucose", 5.5, "mmol/L")).toBeCloseTo(99.09, 1));
  it("cholesterol 5.17 mmol/L ≈ 200 mg/dL", () => expect(toCanonical("total_cholesterol", 5.17, "mmol/L")).toBeCloseTo(199.9, 0));
  it("triglycerides 1.7 mmol/L ≈ 150.6 mg/dL", () => expect(toCanonical("triglycerides", 1.7, "mmol/l")).toBeCloseTo(150.57, 1));
  it("creatinine 88.42 µmol/L = 1 mg/dL", () => expect(toCanonical("creatinine", 88.42, "µmol/L")).toBeCloseTo(1, 5));
  it("HbA1c 48 mmol/mol ≈ 6.54 %", () => expect(toCanonical("hba1c", 48, "mmol/mol")).toBeCloseTo(6.54, 2));
  it("unknown unit → null", () => expect(toCanonical("ldl", 3, "g/L")).toBeNull());
});

describe("evaluation returns exactly normal / outside_range / could_not_read", () => {
  it("fasting glucose: 99 normal, 100 outside (ADA < 100)", () => {
    expect(evaluateLabValue(v({ value: 99 })).flag).toBe("normal");
    expect(evaluateLabValue(v({ value: 100 }))).toMatchObject({ flag: "outside_range", direction: "high" });
  });

  it("fasting glucose in mmol/L: 5.5 normal, 5.6 outside", () => {
    expect(evaluateLabValue(v({ value: 5.5, unit: "mmol/L" })).flag).toBe("normal");
    expect(evaluateLabValue(v({ value: 5.6, unit: "mmol/L" })).flag).toBe("outside_range");
  });

  it("HbA1c: 5.6 % normal, 5.7 % outside, 38 mmol/mol normal, 39 mmol/mol outside", () => {
    const a = (value: number, unit: string) => evaluateLabValue(v({ test_name: "HbA1c", value, unit })).flag;
    expect([a(5.6, "%"), a(5.7, "%"), a(38, "mmol/mol"), a(39, "mmol/mol")]).toEqual(["normal", "outside_range", "normal", "outside_range"]);
  });

  it("HDL is a lower limit: 39 low, 40 normal", () => {
    expect(evaluateLabValue(v({ test_name: "HDL", value: 39 }))).toMatchObject({ flag: "outside_range", direction: "low" });
    expect(evaluateLabValue(v({ test_name: "HDL", value: 40 })).flag).toBe("normal");
  });

  it("the report's printed range wins over our table", () => {
    const r = evaluateLabValue(v({ value: 105, printed_range_low: 70, printed_range_high: 110 }));
    expect(r).toMatchObject({ flag: "normal", rangeUsed: { source: "report", low: 70, high: 110 } });
    expect(evaluateLabValue(v({ test_name: "Creatinine", value: 1.5, printed_range_low: 0.7, printed_range_high: 1.3 }))).toMatchObject({
      flag: "outside_range", direction: "high",
    });
  });

  it("could_not_read for low confidence, unknown test, missing value, unknown unit, or no range", () => {
    expect(evaluateLabValue(v({ confidence: 0.5 }))).toMatchObject({ flag: "could_not_read", reason: "low_confidence" });
    expect(evaluateLabValue(v({ test_name: "Platelets" }))).toMatchObject({ flag: "could_not_read", reason: "unknown_test" });
    expect(evaluateLabValue(v({ value: null }))).toMatchObject({ flag: "could_not_read", reason: "no_value" });
    expect(evaluateLabValue(v({ unit: "g/L" }))).toMatchObject({ flag: "could_not_read", reason: "unknown_unit" });
    expect(evaluateLabValue(v({ test_name: "Creatinine", value: 1 }))).toMatchObject({ flag: "could_not_read", reason: "no_reference_range" });
    expect(evaluateLabValue(v({ test_name: "Random blood sugar", value: 150 }))).toMatchObject({ flag: "could_not_read", reason: "no_reference_range" });
  });

  it("every table entry has a source and is marked unverified until a clinician signs off", () => {
    for (const r of Object.values(LAB_RANGES)) {
      expect(r.source.length).toBeGreaterThan(10);
      expect(r.verified).toBe(false);
      expect(r.name.km).toMatch(/[ក-៿]/);
    }
  });
});

describe("verification checklist C14 — conversion both ways", () => {
  // The app stores ranges in mg/dL and converts report values in mmol/L up to mg/dL.
  // mg/dL → mmol/L is the inverse factor; check both directions against the checklist approximations.
  const cases = [
    { id: "fasting_glucose", mgdl: 180, approxDivisor: 18, mmol: 180 / 18.016 },
    { id: "total_cholesterol", mgdl: 200, approxDivisor: 38.67, mmol: 200 / 38.67 },
    { id: "triglycerides", mgdl: 150, approxDivisor: 88.57, mmol: 150 / 88.57 },
  ] as const;
  for (const c of cases) {
    it(`${c.id}: ${c.mgdl} mg/dL ≈ ${(c.mgdl / c.approxDivisor).toFixed(2)} mmol/L and back`, () => {
      const factor = LAB_RANGES[c.id].conversions["mmol/l"];
      expect(c.mgdl / factor).toBeCloseTo(c.mgdl / c.approxDivisor, 1); // mg/dL → mmol/L
      expect(toCanonical(c.id, c.mmol, "mmol/L")).toBeCloseTo(c.mgdl, 6); // mmol/L → mg/dL
      expect(toCanonical(c.id, c.mgdl, "mg/dL")).toBe(c.mgdl); // already canonical
    });
  }
});
