import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import km from "@/i18n/km.json";
import { TB_SYMPTOMS, tbSymptomModule } from "./definition";
import { MODULES, chooseModules, runModules } from "../registry";
import type { Profile } from "../profile";
import { questionsToAsk, type Answers } from "../types";

const p: Profile = {
  age: 35, sex: "female", heightCm: 155, weightKg: 50, waistCm: 75, smokingStatus: "never", cigarettesPerDay: null, smokingYears: null,
  sbp: 115, dbp: 75, bpMedication: false, knownDiabetes: false, knownHighBp: false, knownHeartDisease: false, knownKidneyDisease: false,
  familyDiabetes: "none", pregnant: false, province: null, district: null,
};
const none: Answers = { tbCough: false, tbCoughBlood: false, tbFever: false, tbNightSweats: false, tbWeightLoss: false, tbContact: false };
const get = (obj: unknown, key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);

describe("TB symptom screen (WHO Module 2, 2021)", () => {
  it("asks the five Table 3 symptoms (cough, haemoptysis, fever, night sweats, weight loss) plus close contact", () => {
    expect(tbSymptomModule.questions.map((q) => q.id)).toEqual(["tbCough", "tbCoughLong", "tbCoughBlood", "tbFever", "tbNightSweats", "tbWeightLoss", "tbContact"]);
  });

  it("adaptive: 'cough for 2 weeks or more' is asked only after cough = yes, and only adds a factor (Table 3 prolonged cough)", () => {
    const ids = (a: Answers) => questionsToAsk(tbSymptomModule.questions, a, p).map((q) => q.id);
    expect(ids({})).not.toContain("tbCoughLong");
    expect(ids({ tbCough: false })).not.toContain("tbCoughLong");
    expect(ids({ tbCough: true })).toEqual(["tbCough", "tbCoughLong", "tbCoughBlood", "tbFever", "tbNightSweats", "tbWeightLoss", "tbContact"]);
    const short = tbSymptomModule.score({ ...none, tbCough: true, tbCoughLong: false }, p);
    const long = tbSymptomModule.score({ ...none, tbCough: true, tbCoughLong: true }, p);
    expect([short.band, long.band]).toEqual(["positive", "positive"]); // same result either way
    expect(long.factors.map((f) => f.factor)).toEqual(["tb_symptom_tbCough", "tb_cough_2w"]);
    expect(short.factors.map((f) => f.factor)).toEqual(["tb_symptom_tbCough"]);
  });

  it("any one symptom → positive: get a TB test, high urgency (Table 3 'any TB symptom')", () => {
    for (const s of TB_SYMPTOMS) {
      const r = tbSymptomModule.score({ ...none, [s]: true }, p);
      expect(r).toMatchObject({ band: "positive", urgency: "high", nextStepKey: "results.nextSteps.tb_test", score: null });
      expect(r.factors).toEqual([{ factor: `tb_symptom_${s}` }]);
    }
  });

  it("several symptoms are all listed, in the source's order", () => {
    const r = tbSymptomModule.score({ ...none, tbWeightLoss: true, tbCough: true, tbContact: true }, p);
    expect(r.factors.map((f) => f.factor)).toEqual(["tb_symptom_tbCough", "tb_symptom_tbWeightLoss", "tb_contact"]);
  });

  it("no symptoms but a close contact → get checked (Recommendation 4), moderate urgency", () => {
    expect(tbSymptomModule.score({ ...none, tbContact: true }, p)).toMatchObject({ band: "contact", urgency: "moderate", nextStepKey: "results.nextSteps.tb_contact_check" });
  });

  it("no symptoms, no contact → negative, with the honest 'misses about 3 in 10' message (sensitivity 0.71)", () => {
    const r = tbSymptomModule.score(none, p);
    expect(r).toMatchObject({ band: "negative", urgency: "low", nextStepKey: "results.nextSteps.tb_watch", factors: [], details: { sensitivity: 0.71 } });
    expect(en.results.nextSteps.tb_watch).toContain("3 in 10");
  });

  it("Table 2 risk factors from the profile are recorded but never change the result", () => {
    const risky: Profile = { ...p, knownDiabetes: true, smokingStatus: "former", pregnant: true };
    const r = tbSymptomModule.score(none, risky);
    expect(r).toMatchObject({ band: "negative", factors: [], details: { riskFactors: ["diabetes", "smoking", "pregnancy"] } });
  });

  it("is offered to every adult and pre-selected", () => {
    expect(tbSymptomModule.eligibility({ ...p, age: 18 }).eligible).toBe(true);
    expect(tbSymptomModule.eligibility({ ...p, age: 14 })).toEqual({ eligible: false, reason: "age_under_15" });
    expect(chooseModules(p, MODULES).find((c) => c.module.id === "tb_symptom")).toMatchObject({ eligible: true, preselected: true });
  });

  it("a positive TB card sorts before low-urgency cards on the dashboard", () => {
    const cards = runModules(p, ["findrisc", "tb_symptom"], { findrisc: { physicallyActive: true, dailyVegFruit: true, highGlucoseHistory: false }, tb_symptom: { ...none, tbFever: true } }, MODULES);
    expect(cards[0].moduleId).toBe("tb_symptom");
  });

  it("every i18n key the module uses exists in English and Khmer", () => {
    const keys = tbSymptomModule.questions.flatMap((q) => [q.textKey, q.helpKey]).filter(Boolean) as string[];
    keys.push("results.nextSteps.tb_test", "results.nextSteps.tb_contact_check", "results.nextSteps.tb_watch", "check.reasons.age_under_15");
    keys.push(...[...TB_SYMPTOMS.map((s) => `tb_symptom_${s}`), "tb_contact"].map((f) => `results.factors.${f}`));
    for (const k of keys) {
      expect(typeof get(en, k), `en ${k}`).toBe("string");
      expect(typeof get(km, k), `km ${k}`).toBe("string");
    }
    for (const b of Object.values(tbSymptomModule.bands)) expect(b.en && b.km).toBeTruthy();
  });
});
