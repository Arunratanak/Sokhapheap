import { describe, expect, it } from "vitest";
import { calculateFindrisc, findriscBand, FINDRISC_CUTOFFS, validateFindriscInput, type FindriscInput } from "./findrisc";

// Base person scores 0: age 30, BMI 20.8 (170 cm / 60 kg), waist 80 cm (male), healthy habits.
const base: FindriscInput = {
  age: 30, sex: "male", heightCm: 170, weightKg: 60, waistCm: 80,
  physicallyActive: true, dailyVegFruit: true, bpMedication: false, highGlucoseHistory: false, familyHistory: "none",
};
const score = (o: Partial<FindriscInput>) => calculateFindrisc({ ...base, ...o }).score;

describe("FINDRISC — 10 hand-calculated cases", () => {
  it("1. healthy base person → 0, low", () => {
    const r = calculateFindrisc(base);
    expect(r).toMatchObject({ score: 0, band: "low", recommendGlucoseTest: false, factors: [], incomplete: [] });
    expect(r.bmi).toBe(20.8);
  });

  it("2. age cut-offs: 44→0, 45→2, 54→2, 55→3, 64→3, 65→4", () => {
    expect([44, 45, 54, 55, 64, 65].map((age) => score({ age }))).toEqual([0, 2, 2, 3, 3, 4]);
  });

  it("3. BMI cut-offs: 24.99→0, 25.0→1, 30.0→1, 30.25→3", () => {
    expect(score({ heightCm: 200, weightKg: 99.96 })).toBe(0); // 24.99
    expect(score({ heightCm: 200, weightKg: 100 })).toBe(1); // 25.0
    expect(score({ heightCm: 200, weightKg: 120 })).toBe(1); // 30.0
    expect(score({ heightCm: 200, weightKg: 121 })).toBe(3); // 30.25
  });

  it("4. waist cut-offs, men: 93.9→0, 94→3, 102→3, 102.1→4", () => {
    expect([93.9, 94, 102, 102.1].map((waistCm) => score({ waistCm }))).toEqual([0, 3, 3, 4]);
  });

  it("5. waist cut-offs, women: 79.9→0, 80→3, 88→3, 88.1→4", () => {
    expect([79.9, 80, 88, 88.1].map((waistCm) => score({ sex: "female", waistCm }))).toEqual([0, 3, 3, 4]);
  });

  it("6. lifestyle and history items: activity 2, diet 1, BP meds 2, high glucose 5, family 3/5", () => {
    expect(score({ physicallyActive: false })).toBe(2);
    expect(score({ dailyVegFruit: false })).toBe(1);
    expect(score({ bpMedication: true })).toBe(2);
    expect(score({ highGlucoseHistory: true })).toBe(5);
    expect(score({ familyHistory: "second_degree" })).toBe(3);
    expect(score({ familyHistory: "first_degree" })).toBe(5);
  });

  it("7. maximum possible score = 26, very high", () => {
    const r = calculateFindrisc({
      age: 70, sex: "male", heightCm: 160, weightKg: 90, waistCm: 110, physicallyActive: false,
      dailyVegFruit: false, bpMedication: true, highGlucoseHistory: true, familyHistory: "first_degree",
    });
    expect(r.score).toBe(26);
    expect(r.band).toBe("very_high");
  });

  it("8. band edges via full inputs: 6 low, 7 slight, 11 slight, 12 moderate, 14 moderate, 15 high, 20 high, 21 very high", () => {
    const cases: [Partial<FindriscInput>, number, string][] = [
      [{ age: 70, physicallyActive: false }, 6, "low"],
      [{ age: 45, highGlucoseHistory: true }, 7, "slightly_elevated"],
      [{ age: 55, heightCm: 200, weightKg: 110, highGlucoseHistory: true, physicallyActive: false }, 11, "slightly_elevated"],
      [{ age: 55, heightCm: 200, weightKg: 110, highGlucoseHistory: true, physicallyActive: false, dailyVegFruit: false }, 12, "moderate"],
      [{ age: 55, waistCm: 95, highGlucoseHistory: true, bpMedication: true, dailyVegFruit: false }, 14, "moderate"],
      [{ age: 65, waistCm: 95, highGlucoseHistory: true, bpMedication: true, dailyVegFruit: false }, 15, "high"],
      [{ age: 65, heightCm: 160, weightKg: 90, waistCm: 110, highGlucoseHistory: true, bpMedication: true, physicallyActive: false }, 20, "high"],
      [{ age: 65, heightCm: 160, weightKg: 90, waistCm: 110, highGlucoseHistory: true, bpMedication: true, physicallyActive: false, dailyVegFruit: false }, 21, "very_high"],
    ];
    for (const [o, s, band] of cases) {
      const r = calculateFindrisc({ ...base, ...o });
      expect([r.score, r.band]).toEqual([s, band]);
    }
  });

  it("9. glucose test recommended from 12 points", () => {
    expect(calculateFindrisc({ ...base, age: 55, heightCm: 200, weightKg: 110, highGlucoseHistory: true, physicallyActive: false }).recommendGlucoseTest).toBe(false); // 11
    expect(calculateFindrisc({ ...base, age: 55, heightCm: 200, weightKg: 110, highGlucoseHistory: true, physicallyActive: false, dailyVegFruit: false }).recommendGlucoseTest).toBe(true); // 12
  });

  it("10. unknown waist → lower-bound score with max +4, and factors sorted by points", () => {
    const r = calculateFindrisc({ ...base, waistCm: null, age: 60, highGlucoseHistory: true, dailyVegFruit: false });
    expect(r.score).toBe(9);
    expect(r.scoreMax).toBe(13);
    expect(r.band).toBe("slightly_elevated");
    expect(r.bandMax).toBe("moderate");
    expect(r.incomplete).toEqual(["waist"]);
    expect(r.factors).toEqual([
      { factor: "high_glucose_history", points: 5 },
      { factor: "age", points: 3 },
      { factor: "diet", points: 1 },
    ]);
  });
});

describe("FINDRISC — bands, validation and config", () => {
  it("band function matches the specified bands exactly", () => {
    expect([0, 6, 7, 11, 12, 14, 15, 20, 21, 26].map(findriscBand)).toEqual([
      "low", "low", "slightly_elevated", "slightly_elevated", "moderate", "moderate", "high", "high", "very_high", "very_high",
    ]);
  });

  it("rejects impossible input", () => {
    expect(validateFindriscInput({ ...base, age: 10, heightCm: 20, weightKg: 1000, waistCm: 5 })).toHaveLength(4);
    expect(() => calculateFindrisc({ ...base, age: Number.NaN })).toThrow(RangeError);
  });

  it("Asian cut-offs stay disabled and unfilled until verified", () => {
    expect(FINDRISC_CUTOFFS.asian.enabled).toBe(false);
    expect(FINDRISC_CUTOFFS.asian.bmi).toBeNull();
    expect(() => calculateFindrisc(base, "asian")).toThrow(/not verified/);
  });
});

describe("FINDRISC — verification checklist C2–C7 (exact values)", () => {
  // BMI targets on a 200 cm person: weight = BMI × 4.
  const bmiScore = (bmi: number) => score({ heightCm: 200, weightKg: bmi * 4 });

  it("C2: age 44/45, 54/55, 64/65", () => {
    expect([44, 45, 54, 55, 64, 65].map((age) => score({ age }))).toEqual([0, 2, 2, 3, 3, 4]);
  });
  it("C2: BMI 24.9 / 25 / 30 / 30.1 → 0 / 1 / 1 / 3", () => {
    expect([24.9, 25, 30, 30.1].map(bmiScore)).toEqual([0, 1, 1, 3]);
  });
  it("C2: waist men 93 / 94 / 102 / 103 → 0 / 3 / 3 / 4", () => {
    expect([93, 94, 102, 103].map((waistCm) => score({ waistCm }))).toEqual([0, 3, 3, 4]);
  });
  it("C2: waist women 79 / 80 / 88 / 89 → 0 / 3 / 3 / 4", () => {
    expect([79, 80, 88, 89].map((waistCm) => score({ sex: "female", waistCm }))).toEqual([0, 3, 3, 4]);
  });
  it("C3/C4: bands and glucose-test flag at 6, 7, 11, 12, 14, 15, 20, 21", () => {
    const rows = [6, 7, 11, 12, 14, 15, 20, 21].map((s) => [s, findriscBand(s), s >= 12]);
    expect(rows).toEqual([
      [6, "low", false], [7, "slightly_elevated", false], [11, "slightly_elevated", false], [12, "moderate", true],
      [14, "moderate", true], [15, "high", true], [20, "high", true], [21, "very_high", true],
    ]);
  });
  it("C5: minimum 0 and maximum 26", () => {
    expect(calculateFindrisc(base).score).toBe(0);
    expect(calculateFindrisc({
      age: 80, sex: "female", heightCm: 150, weightKg: 100, waistCm: 120, physicallyActive: false,
      dailyVegFruit: false, bpMedication: true, highGlucoseHistory: true, familyHistory: "first_degree",
    }).score).toBe(26);
  });
  it("C6: BMI = kg / m² with height in cm", () => {
    expect(calculateFindrisc({ ...base, heightCm: 165, weightKg: 78 }).bmi).toBe(28.7); // 78 / 1.65² = 28.65
    expect(calculateFindrisc({ ...base, heightCm: 150, weightKg: 45 }).bmi).toBe(20); // 45 / 1.5² = 20.0
  });
  it("C7: returned factors always add up to the total score", () => {
    const people: Partial<FindriscInput>[] = [
      {}, { age: 60, waistCm: 100, bpMedication: true }, { age: 50, sex: "female", waistCm: 85, familyHistory: "second_degree", dailyVegFruit: false },
      { age: 70, heightCm: 160, weightKg: 90, waistCm: 110, physicallyActive: false, dailyVegFruit: false, bpMedication: true, highGlucoseHistory: true, familyHistory: "first_degree" },
      { age: 58, waistCm: null, highGlucoseHistory: true },
    ];
    for (const p of people) {
      const r = calculateFindrisc({ ...base, ...p });
      expect(r.factors.reduce((s, f) => s + f.points, 0)).toBe(r.score);
    }
  });
});
