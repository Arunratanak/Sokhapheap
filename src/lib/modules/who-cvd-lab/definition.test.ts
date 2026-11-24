/**
 * WHO lab-based CVD module layer. Chart cells, groups and bands are tested in src/lib/scoring/whoCvdLab.test.ts.
 */
import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/en.json";
import km from "@/lib/i18n/km.json";
import { whoCvdLabModule } from "./definition";
import { MODULES, chooseModules, runModules } from "../registry";
import type { Profile } from "../profile";
import { questionsToAsk, type Answers } from "../types";

const p: Profile = {
  age: 61, sex: "male", heightCm: 165, weightKg: 78, waistCm: 98, smokingStatus: "current", cigarettesPerDay: 10, smokingYears: 20,
  sbp: 125, dbp: 80, bpMedication: false, knownDiabetes: false, knownHighBp: false, knownHeartDisease: false, knownKidneyDisease: false,
  familyDiabetes: "none", pregnant: null, province: null, district: null,
};
const a: Answers = { totalCholesterol: 4.2, cholesterolUnit: "mmol/L", glucoseTest: "normal" };

const get = (obj: unknown, key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);

describe("WHO lab-based CVD module", () => {
  it("eligibility boundaries: 39 no, 40 yes, 74 yes, 75 no", () => {
    expect([39, 40, 74, 75].map((age) => whoCvdLabModule.eligibility({ ...p, age }).eligible)).toEqual([false, true, true, false]);
  });

  it("no diabetes · men · smoker · 60–64 · SBP 120–139 · TC 4.2 → 11% (10–<20), moderate, WHO 3–6-month follow-up", () => {
    expect(whoCvdLabModule.score(a, p)).toMatchObject({
      score: 11, band: "10-20", urgency: "moderate", nextStepKey: "results.nextSteps.cvd_followup_10_20",
      details: { groups: { age: "60-64", sbp: "120-139", cholesterol: "4-4.9", diabetes: false }, cholesterolMmol: 4.2 },
    });
  });

  it("mg/dL is converted with the source factor (162 mg/dL ≈ 4.19 mmol/L → same cell as 4.2 mmol/L)", () => {
    expect(whoCvdLabModule.score({ ...a, totalCholesterol: 162, cholesterolUnit: "mg/dL" }, p).score).toBe(11);
  });

  it("known diabetes in the profile counts as diabetes even if the glucose answer says normal", () => {
    const r = whoCvdLabModule.score(a, { ...p, knownDiabetes: true });
    expect(r.details).toMatchObject({ groups: { diabetes: true } });
    expect(r.score).toBe(17); // diabetes · men · smoker · 60–64 · 120–139 · 4–4.9 (chart: 15 17 19 22 26)
  });

  it("a high blood-sugar test counts as diabetes (Table 2 definition)", () => {
    expect(whoCvdLabModule.score({ ...a, glucoseTest: "high" }, p).details).toMatchObject({ groups: { diabetes: true } });
  });

  it("former smokers are not 'smokers' on the chart (Table 2: current smoker)", () => {
    expect(whoCvdLabModule.score(a, { ...p, smokingStatus: "former" }).score).toBe(7); // no diabetes · men · non-smoker · 60–64 · 120–139 · 4–4.9 (chart: 6 7 8 9 10)
  });

  it("next steps follow Table 3 by band", () => {
    const young = { ...p, age: 40, smokingStatus: "never" as const, sbp: 110 };
    expect(whoCvdLabModule.score({ ...a, totalCholesterol: 3.5 }, young)).toMatchObject({ band: "<5", urgency: "low", nextStepKey: "results.nextSteps.healthy_habits" });
    const old = { ...p, age: 72, sbp: 185 };
    expect(whoCvdLabModule.score({ ...a, totalCholesterol: 7.5 }, old)).toMatchObject({ band: ">=30", urgency: "high", nextStepKey: "results.nextSteps.see_doctor_soon" });
  });

  it("total cholesterol ≥ 8 mmol/L (320 mg/dL) → see a doctor, high urgency, even when the chart risk is low (Table 3)", () => {
    const young = { ...p, age: 40, smokingStatus: "never" as const, sbp: 110 };
    for (const ans of [{ ...a, totalCholesterol: 8.1 }, { ...a, totalCholesterol: 320, cholesterolUnit: "mg/dL" }])
      expect(whoCvdLabModule.score(ans, young)).toMatchObject({ urgency: "high", nextStepKey: "results.nextSteps.cholesterol_very_high", details: { veryHighCholesterol: true } });
    expect(whoCvdLabModule.score({ ...a, totalCholesterol: 7.9 }, young).details).toMatchObject({ veryHighCholesterol: false });
  });

  it("missing inputs → unavailable with the matching next step", () => {
    const cases: [Answers, Profile, string, string][] = [
      [a, { ...p, sbp: null }, "bp_unknown", "check_bp"],
      [{ ...a, totalCholesterol: null }, p, "cholesterol_unknown", "cholesterol_test"],
      [{ ...a, glucoseTest: "not_tested" }, p, "diabetes_unknown", "glucose_test"],
    ];
    for (const [ans, prof, reason, step] of cases)
      expect(whoCvdLabModule.score(ans, prof)).toMatchObject({ band: "unavailable", urgency: "incomplete", nextStepKey: `results.nextSteps.${step}`, details: { reason } });
  });

  it("diabetes is not 'unknown' when the profile already says diabetes", () => {
    expect(whoCvdLabModule.score({ ...a, glucoseTest: "not_tested" }, { ...p, knownDiabetes: true }).band).not.toBe("unavailable");
  });

  it("a number that does not fit the chosen unit is not scored (e.g. 200 entered as mmol/L)", () => {
    expect(whoCvdLabModule.score({ ...a, totalCholesterol: 200 }, p)).toMatchObject({ band: "unavailable", details: { reason: "cholesterol_check_unit" } });
    expect(whoCvdLabModule.score({ ...a, totalCholesterol: 5, cholesterolUnit: "mg/dL" }, p)).toMatchObject({ band: "unavailable", details: { reason: "cholesterol_check_unit" } });
  });

  it("every unavailable reason has km/en text, and every i18n key the module uses exists in both languages", () => {
    for (const reason of ["cholesterol_unknown", "cholesterol_check_unit", "diabetes_unknown"]) {
      expect(whoCvdLabModule.bands[`unavailable:${reason}`]?.en).toBeTruthy();
      expect(whoCvdLabModule.bands[`unavailable:${reason}`]?.km).toBeTruthy();
    }
    const keys = whoCvdLabModule.questions.flatMap((q) => [q.textKey, q.helpKey, ...(q.kind === "choice" ? q.options.map((o) => o.labelKey) : [])]).filter(Boolean) as string[];
    keys.push(...["cholesterol_test", "cvd_followup_5_10", "cvd_followup_10_20", "cholesterol_very_high"].map((k) => `results.nextSteps.${k}`));
    for (const k of keys) {
      expect(typeof get(en, k), `en ${k}`).toBe("string");
      expect(typeof get(km, k), `km ${k}`).toBe("string");
    }
  });

  it("is offered but not pre-selected (opt-in); the non-lab heart check stays pre-selected", () => {
    const choices = chooseModules(p, MODULES);
    expect(choices.find((c) => c.module.id === "who_cvd_lab")).toMatchObject({ eligible: true, preselected: false });
    expect(choices.find((c) => c.module.id === "who_cvd")).toMatchObject({ eligible: true, preselected: true });
  });

  it("runs in the registry next to the non-lab chart, which it does not change", () => {
    const cards = runModules(p, ["who_cvd", "who_cvd_lab"], { who_cvd_lab: a }, MODULES);
    expect(cards.map((c) => c.moduleId).sort()).toEqual(["who_cvd", "who_cvd_lab"]);
    expect(cards.find((c) => c.moduleId === "who_cvd")!.result).toEqual(MODULES.find((m) => m.id === "who_cvd")!.score({}, p));
  });
});

describe("WHO lab-based CVD module: only the questions that apply", () => {
  const ids = (ans: Answers, prof: Profile) => questionsToAsk(whoCvdLabModule.questions, ans, prof).map((q) => q.id);
  it("asks the cholesterol unit only after a number was entered", () => {
    expect(ids({}, p)).toEqual(["totalCholesterol", "glucoseTest"]);
    expect(ids({ totalCholesterol: null }, p)).toEqual(["totalCholesterol", "glucoseTest"]);
    expect(ids({ totalCholesterol: 5.2 }, p)).toEqual(["totalCholesterol", "cholesterolUnit", "glucoseTest"]);
  });
  it("skips the blood-sugar test question when the profile already says diabetes", () => {
    expect(ids({}, { ...p, knownDiabetes: true })).toEqual(["totalCholesterol"]);
  });
});
