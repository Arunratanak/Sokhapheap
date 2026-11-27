/**
 * FINDRISC module layer. Every FINDRISC cut-off (age, BMI, waist, bands, glucose-test flag, min/max)
 * is boundary-tested in src/domain/scoring/findrisc.test.ts, which this module calls unchanged.
 */
import { describe, expect, it } from "vitest";
import { findriscModule } from "./definition";
import type { Profile } from "../profile";

const p: Profile = {
  age: 30, sex: "male", heightCm: 170, weightKg: 60, waistCm: 80, smokingStatus: "never", cigarettesPerDay: null, smokingYears: null,
  sbp: null, dbp: null, bpMedication: false, knownDiabetes: false, knownHighBp: false, knownHeartDisease: false, knownKidneyDisease: false,
  familyDiabetes: "none", pregnant: null, province: null, district: null,
};
const healthy = { physicallyActive: true, dailyVegFruit: true, highGlucoseHistory: false };
const score = (o: Partial<Profile>, a: Record<string, boolean> = {}) => findriscModule.score({ ...healthy, ...a }, { ...p, ...o });

describe("FINDRISC module", () => {
  it("band → urgency and next step at every band edge (scores 6, 7, 11, 12, 14, 15, 20, 21)", () => {
    const rows = [
      [score({ age: 70 }, { physicallyActive: false }), 6, "low", "healthy_habits"],
      [score({ age: 45 }, { highGlucoseHistory: true }), 7, "low", "healthy_habits"],
      [score({ age: 55, heightCm: 200, weightKg: 110 }, { highGlucoseHistory: true, physicallyActive: false }), 11, "low", "healthy_habits"],
      [score({ age: 55, heightCm: 200, weightKg: 110 }, { highGlucoseHistory: true, physicallyActive: false, dailyVegFruit: false }), 12, "moderate", "glucose_test"],
      [score({ age: 55, waistCm: 95, bpMedication: true }, { highGlucoseHistory: true, dailyVegFruit: false }), 14, "moderate", "glucose_test"],
      [score({ age: 65, waistCm: 95, bpMedication: true }, { highGlucoseHistory: true, dailyVegFruit: false }), 15, "high", "see_doctor_soon"],
      [score({ age: 65, heightCm: 160, weightKg: 90, waistCm: 110, bpMedication: true }, { highGlucoseHistory: true, physicallyActive: false }), 20, "high", "see_doctor_soon"],
      [score({ age: 65, heightCm: 160, weightKg: 90, waistCm: 110, bpMedication: true }, { highGlucoseHistory: true, physicallyActive: false, dailyVegFruit: false }), 21, "high", "see_doctor_soon"],
    ] as const;
    for (const [r, s, urgency, step] of rows) {
      expect([r.score, r.urgency, r.nextStepKey]).toEqual([s, urgency, `results.nextSteps.${step}`]);
    }
  });
  it("min 0 and max 26 through the module", () => {
    expect(score({}).score).toBe(0);
    expect(score({ age: 70, heightCm: 160, weightKg: 90, waistCm: 110, bpMedication: true, familyDiabetes: "first_degree" }, { physicallyActive: false, dailyVegFruit: false, highGlucoseHistory: true }).score).toBe(26);
  });
  it("eligibility: adults 18+ (the profile already enforces 18–120)", () => {
    expect(findriscModule.eligibility({ ...p, age: 18 }).eligible).toBe(true);
    expect(findriscModule.eligibility({ ...p, age: 17 }).eligible).toBe(false);
  });
  it("has no red flags of its own (urgent symptoms are screened before the profile)", () => {
    expect(findriscModule.redFlags(healthy, p)).toBe(false);
  });
  it("every band has km and en labels", () => {
    for (const b of ["low", "slightly_elevated", "moderate", "high", "very_high"]) expect(findriscModule.bands[b].km && findriscModule.bands[b].en).toBeTruthy();
  });
});
