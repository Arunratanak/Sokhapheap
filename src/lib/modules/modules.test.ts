import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runRiskCheck, type NextStep } from "@/lib/risk";
import { riskInputSchema, type RiskInput } from "@/lib/schemas";
import { findriscModule } from "./findrisc/definition";
import { whoCvdModule } from "./who-cvd/definition";
import { PROFILE_FIELDS, bmi, packYears, type Profile } from "./profile";
import { MODULES, PUBLISH_DRAFT_MODULES, chooseModules, previewAllowed, runModules, sortByUrgency, visibleModules, type CardResult } from "./registry";
import type { ModuleDefinition } from "./types";

type Legacy = Omit<RiskInput, "channel" | "save" | "province" | "orgCode">;
const base: Legacy = {
  age: 30, sex: "male", heightCm: 170, weightKg: 60, waistCm: 80, physicallyActive: true, dailyVegFruit: true,
  bpMedication: false, highGlucoseHistory: false, familyHistory: "none", smoker: false, sbp: 120,
};
// The 10 FINDRISC UI cases (tests/e2e/risk-ui.e2e.ts) + the 4 consistency profiles (tests/e2e/consistency.e2e.ts).
const CASES: Legacy[] = [
  base,
  { ...base, age: 45 },
  { ...base, age: 65, sex: "female", waistCm: 80 },
  { ...base, heightCm: 200, weightKg: 121 },
  { ...base, waistCm: 102.1 },
  { ...base, familyHistory: "second_degree", physicallyActive: false },
  { ...base, age: 70, heightCm: 160, weightKg: 90, waistCm: 110, physicallyActive: false, dailyVegFruit: false, bpMedication: true, highGlucoseHistory: true, familyHistory: "first_degree" },
  { ...base, age: 55, heightCm: 200, weightKg: 110, highGlucoseHistory: true, physicallyActive: false, dailyVegFruit: false },
  { ...base, age: 65, waistCm: 95, highGlucoseHistory: true, bpMedication: true, dailyVegFruit: false, sbp: null },
  { ...base, age: 60, waistCm: null, highGlucoseHistory: true, dailyVegFruit: false },
  { age: 42, sex: "male", heightCm: 170, weightKg: 60, waistCm: 80, physicallyActive: true, dailyVegFruit: true, bpMedication: false, highGlucoseHistory: false, familyHistory: "none", smoker: false, sbp: 115 },
  { age: 50, sex: "female", heightCm: 155, weightKg: 62, waistCm: 85, physicallyActive: false, dailyVegFruit: false, bpMedication: false, highGlucoseHistory: false, familyHistory: "second_degree", smoker: false, sbp: 135 },
  { age: 58, sex: "male", heightCm: 165, weightKg: 78, waistCm: 98, physicallyActive: false, dailyVegFruit: false, bpMedication: true, highGlucoseHistory: false, familyHistory: "second_degree", smoker: true, sbp: 150 },
  { age: 58, sex: "male", heightCm: 165, weightKg: 78, waistCm: 98, physicallyActive: false, dailyVegFruit: false, bpMedication: true, highGlucoseHistory: false, familyHistory: "second_degree", smoker: true, sbp: null },
];

const toProfile = (c: Legacy): Profile => ({
  age: c.age, sex: c.sex, heightCm: c.heightCm, weightKg: c.weightKg, waistCm: c.waistCm,
  smokingStatus: c.smoker ? "current" : "never", cigarettesPerDay: null, smokingYears: null,
  sbp: c.sbp, dbp: null, bpMedication: c.bpMedication,
  knownDiabetes: false, knownHighBp: false, knownHeartDisease: false, knownKidneyDisease: false,
  familyDiabetes: c.familyHistory, pregnant: null, province: null, district: null,
});
const toAnswers = (c: Legacy) => ({ findrisc: { physicallyActive: c.physicallyActive, dailyVegFruit: c.dailyVegFruit, highGlucoseHistory: c.highGlucoseHistory } });

const PRIORITY: NextStep[] = ["see_doctor_soon", "glucose_test", "check_bp", "healthy_habits"];

describe("Checkpoint 1: FINDRISC and WHO CVD give identical results after the refactor", () => {
  for (const [i, c] of CASES.entries()) {
    it(`case ${i + 1}: module scores = runRiskCheck()`, () => {
      const legacy = runRiskCheck(riskInputSchema.parse({ ...c, save: false }));
      const cards = runModules(toProfile(c), ["findrisc", "who_cvd"], toAnswers(c), MODULES);
      const f = cards.find((x) => x.moduleId === "findrisc")!.result!;
      expect(f.score).toBe(legacy.findrisc.score);
      expect(f.band).toBe(legacy.findrisc.band);
      expect(f.factors).toEqual(legacy.findrisc.factors);
      expect(f.details).toMatchObject({ scoreMax: legacy.findrisc.scoreMax, bmi: legacy.findrisc.bmi });

      const cvdCard = cards.find((x) => x.moduleId === "who_cvd");
      if (c.age < 40 || c.age > 74) {
        expect(cvdCard).toBeUndefined(); // ineligible → never scored, never shown
        expect(legacy.cvd).toEqual({ available: false, reason: "age_out_of_range" });
      } else if (legacy.cvd.available) {
        expect(cvdCard!.result!.score).toBe(legacy.cvd.riskPercent);
        expect(cvdCard!.result!.band).toBe(legacy.cvd.band);
      } else {
        expect(cvdCard!.result!.band).toBe("unavailable");
        expect(cvdCard!.result!.details).toEqual({ reason: legacy.cvd.reason });
      }

      // The legacy combined next step = the most urgent of the per-module next steps.
      const steps = cards.map((x) => x.result!.nextStepKey.replace("results.nextSteps.", "") as NextStep);
      const combined = PRIORITY.find((s) => steps.includes(s));
      expect(combined).toBe(legacy.nextStep);
    });
  }
});

describe("Clinician gate and preview", () => {
  const draft: ModuleDefinition = { ...findriscModule, id: "test_draft", status: "draft" };
  const verified: ModuleDefinition = { ...findriscModule, id: "test_verified", status: "clinician_verified" };
  it("a draft module is hidden in production unless drafts are published, and visible in preview", () => {
    expect(visibleModules(false, [draft, verified], false).map((m) => m.id)).toEqual(["test_verified"]);
    expect(visibleModules(true, [draft, verified], false).map((m) => m.id)).toEqual(["test_draft", "test_verified"]);
    expect(visibleModules(false, [draft, verified], true).map((m) => m.id)).toEqual(["test_draft", "test_verified"]);
  });
  it("drafts are public only because PUBLISH_DRAFT_MODULES is on (owner decision, 24 Nov 2026)", () => {
    expect(PUBLISH_DRAFT_MODULES).toBe(true);
    expect(visibleModules(false).map((m) => m.id).sort()).toEqual(MODULES.map((m) => m.id).sort());
  });
  it("preview only works on localhost with ?preview=1", () => {
    expect(previewAllowed("localhost:3100", "1")).toBe(true);
    expect(previewAllowed("127.0.0.1:3000", "1")).toBe(true);
    expect(previewAllowed("localhost:3100", undefined)).toBe(false);
    expect(previewAllowed("sokhapheap-6c0l.onrender.com", "1")).toBe(false);
    expect(previewAllowed("localhost.evil.com", "1")).toBe(false);
  });
  it("every real module is still a draft until a clinician signs off", () => {
    expect(MODULES.every((m) => m.status === "draft")).toBe(true);
  });
});

describe("Shared profile is reused", () => {
  it("no module asks a question the profile already answers", () => {
    const profileIds = new Set<string>(PROFILE_FIELDS);
    const aliases: Record<string, string> = { smoker: "smokingStatus", bpMeds: "bpMedication", familyHistory: "familyDiabetes", sbp: "sbp" };
    for (const m of MODULES) {
      for (const q of m.questions) {
        expect(profileIds.has(q.id), `${m.id}.${q.id} duplicates a profile field`).toBe(false);
        expect(aliases[q.id], `${m.id}.${q.id} is a profile question under another name`).toBeUndefined();
      }
      for (const f of m.requiredProfileFields) expect(profileIds.has(f)).toBe(true);
    }
  });
  it("derived values are calculated, not asked", () => {
    expect(Math.round(bmi({ heightCm: 165, weightKg: 78 }) * 10) / 10).toBe(28.7);
    expect(packYears({ smokingStatus: "current", cigarettesPerDay: 20, smokingYears: 10 })).toBe(10);
    expect(packYears({ smokingStatus: "never", cigarettesPerDay: null, smokingYears: null })).toBe(0);
    expect(packYears({ smokingStatus: "former", cigarettesPerDay: null, smokingYears: 5 })).toBeNull();
  });
});

describe("Eligibility, red flags and urgency order", () => {
  const p = toProfile(CASES[12]); // 58-year-old
  it("WHO CVD is offered only to ages 40–74", () => {
    for (const [age, ok] of [[39, false], [40, true], [74, true], [75, false]] as const)
      expect(whoCvdModule.eligibility({ ...p, age }).eligible).toBe(ok);
    const choices = chooseModules({ ...p, age: 30 }, MODULES);
    expect(choices.find((c) => c.module.id === "who_cvd")).toMatchObject({ eligible: false, preselected: false, reason: "age_outside_40_74" });
  });
  it("core modules are pre-selected; sensitive modules are opt-in", () => {
    const sensitive: ModuleDefinition = { ...findriscModule, id: "test_sensitive", sensitivity: "sensitive" };
    const c = chooseModules(p, [findriscModule, sensitive]);
    expect(c.map((x) => [x.module.id, x.preselected])).toEqual([["findrisc", true], ["test_sensitive", false]]);
  });
  it("a red flag stops scoring for that module and is sorted first", () => {
    const flagged: ModuleDefinition = { ...findriscModule, id: "test_flag", healthArea: "lungs", redFlags: (a) => a.coughBlood === true };
    const cards = runModules(p, ["findrisc", "who_cvd", "test_flag"], { ...toAnswers(CASES[12]), test_flag: { coughBlood: true } }, [...MODULES, flagged]);
    expect(cards[0]).toMatchObject({ moduleId: "test_flag", redFlag: true, result: null });
  });
  it("cards sort red flag → high → moderate → low → incomplete", () => {
    const card = (id: string, urgency: string | null, redFlag = false): CardResult => ({
      moduleId: id, healthArea: "heart", redFlag,
      result: urgency ? ({ urgency } as CardResult["result"]) : null,
    });
    const sorted = sortByUrgency([card("e", "incomplete"), card("c", "moderate"), card("d", "low"), card("a", null, true), card("b", "high")]);
    expect(sorted.map((x) => x.moduleId)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("No AI in scoring", () => {
  it("module code never imports AI or network code", () => {
    const dir = path.join(process.cwd(), "src/lib/modules");
    const files = fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      expect(src, f).not.toMatch(/@google\/genai|lib\/ai\/|gemini|fetch\(|openai|anthropic/i);
    }
  });
});
