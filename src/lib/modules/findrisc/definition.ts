/**
 * FINDRISC — type 2 diabetes risk (Lindström & Tuomilehto, Diabetes Care 2003).
 * Wraps the existing, unit-tested calculateFindrisc() — results are identical to the /risk flow.
 * Method card: references/methods/findrisc/METHOD_CARD.md
 */
import en from "@/lib/i18n/en.json";
import km from "@/lib/i18n/km.json";
import { calculateFindrisc, type FindriscBand } from "@/lib/scoring/findrisc";
import type { ModuleDefinition, Urgency } from "../types";

const URGENCY: Record<FindriscBand, Urgency> = {
  low: "low",
  slightly_elevated: "low",
  moderate: "moderate",
  high: "high",
  very_high: "high",
};

export const findriscModule: ModuleDefinition = {
  id: "findrisc",
  healthArea: "metabolic",
  title: { en: "Type 2 diabetes risk", km: "ហានិភ័យជំងឺទឹកនោមផ្អែមប្រភេទទី ២" },
  summary: {
    en: "FINDRISC questionnaire: your risk of type 2 diabetes in the next 10 years.",
    km: "កម្រងសំណួរ FINDRISC៖ ហានិភ័យនៃជំងឺទឹកនោមផ្អែមប្រភេទទី ២ ក្នុងរយៈពេល ១០ ឆ្នាំខាងមុខ។",
  },
  status: "draft", // TODO(VERIFY): clinician sign-off pending (REVIEW.md §2); record in references/reviews/
  sensitivity: "normal",
  eligibility: (p) => (p.age >= 18 ? { eligible: true } : { eligible: false, reason: "age_under_18" }),
  requiredProfileFields: ["age", "sex", "heightCm", "weightKg", "waistCm", "bpMedication", "familyDiabetes"],
  questions: [
    { id: "physicallyActive", kind: "yesno", textKey: "risk.activity.q", helpKey: "risk.activity.help" },
    { id: "dailyVegFruit", kind: "yesno", textKey: "risk.vegFruit.q" },
    { id: "highGlucoseHistory", kind: "yesno", textKey: "risk.highGlucose.q" },
  ],
  redFlags: () => false, // urgent symptoms are handled by the shared urgent screen before the profile
  score: (a, p) => {
    const r = calculateFindrisc({
      age: p.age,
      sex: p.sex,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      waistCm: p.waistCm,
      physicallyActive: a.physicallyActive === true,
      dailyVegFruit: a.dailyVegFruit === true,
      bpMedication: p.bpMedication,
      highGlucoseHistory: a.highGlucoseHistory === true,
      familyHistory: p.familyDiabetes,
    });
    // Same next-step rule as chooseNextStep() in src/lib/risk.ts, applied to FINDRISC alone.
    const nextStepKey =
      r.band === "high" || r.band === "very_high"
        ? "results.nextSteps.see_doctor_soon"
        : r.recommendGlucoseTest
          ? "results.nextSteps.glucose_test"
          : "results.nextSteps.healthy_habits";
    return {
      score: r.score,
      band: r.band,
      urgency: URGENCY[r.band],
      factors: r.factors,
      nextStepKey,
      facilityType: "health_centre",
      details: { scoreMax: r.scoreMax, bandMax: r.bandMax, bmi: r.bmi, incomplete: r.incomplete, recommendGlucoseTest: r.recommendGlucoseTest },
    };
  },
  bands: Object.fromEntries(
    (Object.keys(en.results.findriscBands) as FindriscBand[]).map((b) => [b, { en: en.results.findriscBands[b], km: km.results.findriscBands[b] }]),
  ),
  references: ["R-FINDRISC-2003"],
  monitorIntervalMonths: null, // TODO(VERIFY): no recheck interval in an archived source yet
};
