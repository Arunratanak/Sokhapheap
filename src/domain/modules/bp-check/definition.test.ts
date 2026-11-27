import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import km from "@/i18n/km.json";
import { bpCheckModule } from "./definition";
import { MODULES, chooseModules } from "../registry";
import type { Profile } from "../profile";

const p: Profile = {
  age: 50, sex: "male", heightCm: 165, weightKg: 65, waistCm: 85, smokingStatus: "never", cigarettesPerDay: null, smokingYears: null,
  sbp: 120, dbp: 80, bpMedication: false, knownDiabetes: false, knownHighBp: false, knownHeartDisease: false, knownKidneyDisease: false,
  familyDiabetes: "none", pregnant: null, province: null, district: null,
};
const s = (over: Partial<Profile>) => bpCheckModule.score({}, { ...p, ...over });

describe("Blood pressure check (WHO hypertension guideline 2021)", () => {
  it("no reading → unavailable, 'get your blood pressure measured'", () => {
    expect(s({ sbp: null, dbp: null })).toMatchObject({ band: "unavailable", urgency: "incomplete", nextStepKey: "results.nextSteps.check_bp" });
  });

  it("thresholds 140/90 and 160/100 at the boundaries (systolic or diastolic)", () => {
    const band = (sbp: number, dbp: number) => s({ sbp, dbp }).band;
    expect([band(139, 89), band(140, 80), band(120, 90), band(159, 99), band(160, 80), band(120, 100)]).toEqual([
      "below_140_90", "high", "high", "high", "very_high", "very_high",
    ]);
  });

  it("one high reading is never called a diagnosis: re-measure on another day (confirmed = two different days)", () => {
    expect(s({ sbp: 145, dbp: 85 })).toMatchObject({ band: "high", urgency: "moderate", nextStepKey: "results.nextSteps.bp_recheck" });
    expect(en.results.nextSteps.bp_recheck).toContain("two different days");
  });

  it("≥160/100 → see a doctor soon, high urgency ('treatment should be started without delay'), but no emergency red flag", () => {
    expect(s({ sbp: 190, dbp: 120 })).toMatchObject({ band: "very_high", urgency: "high", nextStepKey: "results.nextSteps.bp_very_high" });
    expect(bpCheckModule.redFlags({}, { ...p, sbp: 220, dbp: 130 })).toBe(false);
  });

  it("on treatment: target <140/90; above it → talk to your health worker", () => {
    expect(s({ bpMedication: true, sbp: 145, dbp: 85 })).toMatchObject({ band: "above_target", nextStepKey: "results.nextSteps.bp_above_target" });
    expect(s({ knownHighBp: true, sbp: 135, dbp: 85 })).toMatchObject({ band: "at_target", urgency: "low", nextStepKey: "results.nextSteps.bp_at_target" });
  });

  it("heart disease, diabetes or kidney disease: systolic target <130; 130–139 is flagged", () => {
    for (const cond of ["knownHeartDisease", "knownDiabetes", "knownKidneyDisease"] as const) {
      expect(s({ [cond]: true, sbp: 132, dbp: 80 })).toMatchObject({ band: "high_risk_130", urgency: "moderate" });
      expect(s({ [cond]: true, bpMedication: true, sbp: 132, dbp: 80 })).toMatchObject({ band: "above_target_130" });
      expect(s({ [cond]: true, bpMedication: true, sbp: 129, dbp: 80 })).toMatchObject({ band: "at_target" });
    }
    expect(s({ sbp: 132, dbp: 80 }).band).toBe("below_140_90"); // no high-risk condition
  });

  it("pregnancy with ≥140/90 → see a doctor or midwife soon (high urgency)", () => {
    const preg = { sex: "female" as const, age: 30, pregnant: true };
    expect(s({ ...preg, sbp: 142, dbp: 88 })).toMatchObject({ band: "pregnancy_high", urgency: "high", nextStepKey: "results.nextSteps.bp_pregnancy" });
    expect(s({ ...preg, sbp: 118, dbp: 76 }).band).toBe("below_140_90");
  });

  it("bottom number unknown → judged on the top number", () => {
    expect(s({ sbp: 150, dbp: null }).band).toBe("high");
    expect(s({ sbp: 120, dbp: null }).band).toBe("below_140_90");
  });

  it("is pre-selected for every adult, and has no extra questions (reading comes from the profile)", () => {
    expect(chooseModules(p, MODULES).find((c) => c.module.id === "bp_check")).toMatchObject({ eligible: true, preselected: true });
    expect(bpCheckModule.questions).toEqual([]);
  });

  it("every band and next step has English and Khmer text", () => {
    const bands = new Set<string>();
    const steps = new Set<string>();
    for (const sbp of [100, 132, 145, 170]) for (const over of [{}, { bpMedication: true }, { knownDiabetes: true }, { knownDiabetes: true, bpMedication: true }, { pregnant: true }, { sbp: null }]) {
      const r = s({ sbp, dbp: 80, ...over });
      bands.add(r.band);
      steps.add(r.nextStepKey.replace("results.nextSteps.", ""));
    }
    for (const b of bands) expect(bpCheckModule.bands[b]?.en && bpCheckModule.bands[b]?.km, b).toBeTruthy();
    for (const k of steps) {
      expect(typeof (en.results.nextSteps as Record<string, string>)[k], `en ${k}`).toBe("string");
      expect(typeof (km.results.nextSteps as Record<string, string>)[k], `km ${k}`).toBe("string");
    }
    expect(bands.size).toBe(Object.keys(bpCheckModule.bands).length); // every band is reachable
  });
});
