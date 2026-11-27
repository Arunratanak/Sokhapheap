import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import km from "@/i18n/km.json";
import { egfrModule } from "./definition";
import { MODULES, chooseModules } from "../registry";
import type { Profile } from "../profile";
import type { Answers } from "../types";

const p: Profile = {
  age: 60, sex: "male", heightCm: 165, weightKg: 65, waistCm: 85, smokingStatus: "never", cigarettesPerDay: null, smokingYears: null,
  sbp: 120, dbp: 80, bpMedication: false, knownDiabetes: false, knownHighBp: false, knownHeartDisease: false, knownKidneyDisease: false,
  familyDiabetes: "none", pregnant: null, province: null, district: null,
};
const a = (creatinine: number | null, creatinineUnit = "mg/dL"): Answers => ({ creatinine, creatinineUnit });
const get = (obj: unknown, key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);

describe("eGFR module (CKD-EPI 2021)", () => {
  it("man 60, creatinine 1.0 mg/dL → eGFR 86, stage 60–89, low urgency", () => {
    expect(egfrModule.score(a(1.0), p)).toMatchObject({ score: 86, band: "60-89", urgency: "low", nextStepKey: "results.nextSteps.egfr_60_plus" });
  });

  it("µmol/L gives the same result (88.4 µmol/L = 1.0 mg/dL)", () => {
    expect(egfrModule.score(a(88.4, "µmol/L"), p).score).toBe(86);
  });

  it("man 70, creatinine 2.0 → eGFR 35 (30–44): below 60, high urgency, not called a diagnosis", () => {
    expect(egfrModule.score(a(2.0), { ...p, age: 70 })).toMatchObject({ score: 35, band: "30-44", urgency: "high", nextStepKey: "results.nextSteps.egfr_below_60" });
    expect(en.results.nextSteps.egfr_below_60).toContain("not a diagnosis");
  });

  it("very high creatinine → below 30, see a doctor", () => {
    expect(egfrModule.score(a(4.0), p)).toMatchObject({ band: "<30", urgency: "high", nextStepKey: "results.nextSteps.egfr_below_30" });
  });

  it("unknown creatinine or a number that doesn't fit the unit → not scored", () => {
    expect(egfrModule.score(a(null), p)).toMatchObject({ band: "unavailable", details: { reason: "creatinine_unknown" }, nextStepKey: "results.nextSteps.creatinine_test" });
    expect(egfrModule.score(a(90, "mg/dL"), p)).toMatchObject({ band: "unavailable", details: { reason: "creatinine_check_unit" } });
    expect(egfrModule.score(a(1.0, "µmol/L"), p)).toMatchObject({ band: "unavailable", details: { reason: "creatinine_check_unit" } });
  });

  it("is offered to adults but opt-in (needs a lab result)", () => {
    expect(chooseModules(p, MODULES).find((c) => c.module.id === "egfr")).toMatchObject({ eligible: true, preselected: false });
  });

  it("every band, next step and question key has English and Khmer text", () => {
    for (const b of Object.values(egfrModule.bands)) expect(b.en && b.km).toBeTruthy();
    const keys = egfrModule.questions.flatMap((q) => [q.textKey, q.helpKey, ...(q.kind === "choice" ? q.options.map((o) => o.labelKey) : [])]).filter(Boolean) as string[];
    keys.push(...["egfr_60_plus", "egfr_below_60", "egfr_below_30", "creatinine_test"].map((k) => `results.nextSteps.${k}`));
    for (const k of keys) {
      expect(typeof get(en, k), `en ${k}`).toBe("string");
      expect(typeof get(km, k), `km ${k}`).toBe("string");
    }
  });
});
