/**
 * WHO CVD module layer. Chart cells, age/SBP/BMI group boundaries and bands are tested in
 * src/lib/scoring/whoCvd.test.ts, which this module calls unchanged.
 */
import { describe, expect, it } from "vitest";
import { whoCvdModule } from "./definition";
import type { Profile } from "../profile";

const p: Profile = {
  age: 58, sex: "male", heightCm: 165, weightKg: 78, waistCm: 98, smokingStatus: "current", cigarettesPerDay: 10, smokingYears: 20,
  sbp: 150, dbp: 90, bpMedication: true, knownDiabetes: false, knownHighBp: false, knownHeartDisease: false, knownKidneyDisease: false,
  familyDiabetes: "second_degree", pregnant: null, province: null, district: null,
};

describe("WHO CVD module", () => {
  it("eligibility boundaries: 39 no, 40 yes, 74 yes, 75 no", () => {
    expect([39, 40, 74, 75].map((age) => whoCvdModule.eligibility({ ...p, age }).eligible)).toEqual([false, true, true, false]);
  });
  it("58-year-old male smoker, SBP 150, BMI 28.7 → 13% (10–<20), moderate urgency (same as the /risk flow)", () => {
    expect(whoCvdModule.score({}, p)).toMatchObject({ score: 13, band: "10-20", urgency: "moderate", nextStepKey: "results.nextSteps.healthy_habits" });
  });
  it("former smokers are not 'smokers' on the chart (current smoking only)", () => {
    const current = whoCvdModule.score({}, p).score!;
    const former = whoCvdModule.score({}, { ...p, smokingStatus: "former" }).score!;
    expect(former).toBeLessThan(current);
  });
  it("blood pressure unknown → unavailable, 'check your blood pressure' next step", () => {
    expect(whoCvdModule.score({}, { ...p, sbp: null })).toMatchObject({ band: "unavailable", urgency: "incomplete", nextStepKey: "results.nextSteps.check_bp" });
  });
  it("≥ 20% → high urgency and see a doctor soon", () => {
    const r = whoCvdModule.score({}, { ...p, age: 72, sbp: 185 });
    expect(r.score).toBeGreaterThanOrEqual(20);
    expect([r.urgency, r.nextStepKey]).toEqual(["high", "results.nextSteps.see_doctor_soon"]);
  });
  it("has no red flags of its own and no extra questions (everything comes from the profile)", () => {
    expect(whoCvdModule.redFlags({}, p)).toBe(false);
    expect(whoCvdModule.questions).toEqual([]);
  });
});
