import { describe, expect, it } from "vitest";
import { calculateFindrisc } from "./scoring/findrisc";
import { WAIST_INCHES, waistCmToInches, waistInchesToCm } from "./units";

describe("waist in inches", () => {
  it("converts inches to cm (1 in = 2.54 cm, 0.1 cm precision) and back", () => {
    expect(waistInchesToCm(38)).toBe(96.5);
    expect(waistInchesToCm(31.5)).toBe(80);
    expect(waistCmToInches(96.5)).toBe(38);
  });
  it("the inch range stays inside the 40–200 cm the scoring accepts", () => {
    expect(waistInchesToCm(WAIST_INCHES.min)).toBeGreaterThanOrEqual(40);
    expect(waistInchesToCm(WAIST_INCHES.max)).toBeLessThanOrEqual(200);
  });
  it("FINDRISC waist points are unchanged when the waist comes from inches (men: <94 → 0, 94–102 → 3, >102 → 4)", () => {
    const base = { age: 30, sex: "male" as const, heightCm: 170, weightKg: 60, physicallyActive: true, dailyVegFruit: true, bpMedication: false, highGlucoseHistory: false, familyHistory: "none" as const };
    const pts = (inches: number) => calculateFindrisc({ ...base, waistCm: waistInchesToCm(inches) }).score;
    expect([36, 37, 40, 41].map(pts)).toEqual([0, 3, 3, 4]); // 91.4, 94.0, 101.6, 104.1 cm
  });
});
