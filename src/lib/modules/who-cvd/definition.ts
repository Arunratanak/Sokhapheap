/**
 * WHO 2019 non-laboratory CVD risk chart, South-East Asia (HEARTS technical package 2020, PDF page 65).
 * Wraps the existing, unit-tested calculateWhoCvd() — results are identical to the /risk flow
 * (BMI is rounded to 1 decimal first, exactly like runRiskCheck() does).
 * Method card: references/methods/who-cvd/METHOD_CARD.md
 */
import en from "@/lib/i18n/en.json";
import km from "@/lib/i18n/km.json";
import { calculateWhoCvd, type CvdBand } from "@/lib/scoring/whoCvd";
import { bmi, isCurrentSmoker } from "../profile";
import type { ModuleDefinition, Urgency } from "../types";

const URGENCY: Record<CvdBand, Urgency> = { "<5": "low", "5-10": "low", "10-20": "moderate", "20-30": "high", ">=30": "high" };

export const whoCvdModule: ModuleDefinition = {
  id: "who_cvd",
  healthArea: "heart",
  title: { en: "Heart attack and stroke risk (10 years)", km: "ហានិភ័យគាំងបេះដូង និងដាច់សរសៃឈាមខួរក្បាល (១០ ឆ្នាំ)" },
  summary: {
    en: "WHO risk chart for South-East Asia, for adults aged 40–74. Needs your blood pressure.",
    km: "តារាងហានិភ័យរបស់ WHO សម្រាប់អាស៊ីអាគ្នេយ៍ សម្រាប់មនុស្សពេញវ័យអាយុ ៤០–៧៤ ឆ្នាំ។ ត្រូវការសម្ពាធឈាមរបស់អ្នក។",
  },
  status: "draft", // TODO(VERIFY): clinician check of 10 chart cells pending (REVIEW.md §2b)
  sensitivity: "normal",
  // The chart covers ages 40–74 only (source: chart axes, PDF page 65).
  eligibility: (p) => (p.age >= 40 && p.age <= 74 ? { eligible: true } : { eligible: false, reason: "age_outside_40_74" }),
  requiredProfileFields: ["age", "sex", "smokingStatus", "sbp", "heightCm", "weightKg"],
  questions: [],
  redFlags: () => false,
  score: (_a, p) => {
    const r = calculateWhoCvd({
      age: p.age,
      sex: p.sex,
      smoker: isCurrentSmoker(p),
      sbp: p.sbp,
      bmi: Math.round(bmi(p) * 10) / 10,
    });
    if (!r.available) {
      return {
        score: null,
        band: "unavailable",
        urgency: "incomplete",
        factors: [],
        nextStepKey: r.reason === "bp_unknown" ? "results.nextSteps.check_bp" : "results.nextSteps.healthy_habits",
        facilityType: "health_centre",
        details: { reason: r.reason },
      };
    }
    return {
      score: r.riskPercent,
      band: r.band,
      urgency: URGENCY[r.band],
      factors: [],
      nextStepKey: r.band === "20-30" || r.band === ">=30" ? "results.nextSteps.see_doctor_soon" : "results.nextSteps.healthy_habits",
      facilityType: "health_centre",
      details: { groups: r.groups },
    };
  },
  bands: {
    ...Object.fromEntries((Object.keys(en.results.cvdBands) as CvdBand[]).map((b) => [b, { en: en.results.cvdBands[b], km: km.results.cvdBands[b] }])),
    unavailable: { en: en.results.cvdUnavailable.bp_unknown, km: km.results.cvdUnavailable.bp_unknown },
  },
  references: ["R-WHO-HEARTS-2020"],
  monitorIntervalMonths: null, // TODO(VERIFY): read the HEARTS follow-up intervals from the archived PDF before setting this
};
