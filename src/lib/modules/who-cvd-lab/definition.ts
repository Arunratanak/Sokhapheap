/**
 * WHO 2019 laboratory-based CVD risk chart, South-East Asia (HEARTS technical package 2020, Annex 2, PDF page 44).
 * Uses total cholesterol and diabetes status in addition to the profile (age, sex, current smoking, SBP).
 * Method card: references/methods/who-cvd-lab/METHOD_CARD.md
 *
 * Next steps follow Table 3 "Management guidance for total CVD risk" (PDF page 21) — wording is SokhaPheap's,
 * TODO(VERIFY): clinician to confirm the wording.
 */
import en from "@/lib/i18n/en.json";
import km from "@/lib/i18n/km.json";
import type { CvdBand } from "@/lib/scoring/whoCvd";
import { calculateWhoCvdLab, toMmol, type CholUnit } from "@/lib/scoring/whoCvdLab";
import { isCurrentSmoker } from "../profile";
import type { ModuleDefinition, ModuleResult, Urgency } from "../types";

const URGENCY: Record<CvdBand, Urgency> = { "<5": "low", "5-10": "low", "10-20": "moderate", "20-30": "high", ">=30": "high" };

/** Table 3: <5% follow up in 12 months; 5–<10% every 3 months, then 6–9 months; 10–<20% every 3–6 months; ≥20% every 3 months. */
const NEXT_STEP: Record<CvdBand, string> = {
  "<5": "results.nextSteps.healthy_habits",
  "5-10": "results.nextSteps.cvd_followup_5_10",
  "10-20": "results.nextSteps.cvd_followup_10_20",
  "20-30": "results.nextSteps.see_doctor_soon",
  ">=30": "results.nextSteps.see_doctor_soon",
};

/** Table 3: "Consider drug treatment for … all individuals with total cholesterol at or above 8 mmol/L (320 mg/dL)." */
export const TC_TREATMENT_MMOL = 8;

/**
 * Plausible total cholesterol in mmol/L. Outside this range the number almost certainly does not match the
 * unit chosen (e.g. 200 entered as mmol/L), so we ask the user to check instead of scoring it.
 * TODO(VERIFY): clinician to confirm the plausibility range (not from the source).
 */
export const TC_PLAUSIBLE_MMOL = { min: 1, max: 20 } as const;

const unavailable = (reason: string, nextStepKey: string): ModuleResult => ({
  score: null,
  band: "unavailable",
  urgency: "incomplete",
  factors: [],
  nextStepKey,
  facilityType: "health_centre",
  details: { reason },
});

export const whoCvdLabModule: ModuleDefinition = {
  id: "who_cvd_lab",
  healthArea: "heart",
  title: { en: "Heart attack and stroke risk, with blood tests (10 years)", km: "ហានិភ័យគាំងបេះដូង និងដាច់សរសៃឈាមខួរក្បាល ដោយប្រើតេស្តឈាម (១០ ឆ្នាំ)" },
  summary: {
    en: "WHO risk chart for South-East Asia, for adults aged 40–74. Needs your blood pressure and a cholesterol result from a blood test.",
    km: "តារាងហានិភ័យរបស់ WHO សម្រាប់អាស៊ីអាគ្នេយ៍ សម្រាប់មនុស្សពេញវ័យអាយុ ៤០–៧៤ ឆ្នាំ។ ត្រូវការសម្ពាធឈាម និងលទ្ធផលកូឡេស្តេរ៉ុលពីតេស្តឈាមរបស់អ្នក។",
  },
  status: "draft", // TODO(VERIFY): clinician check of the sample chart cells in the method card pending
  sensitivity: "normal",
  optIn: true, // needs a cholesterol result; the non-lab heart check is the default
  // The chart covers ages 40–74 only (chart axes, PDF page 44).
  eligibility: (p) => (p.age >= 40 && p.age <= 74 ? { eligible: true } : { eligible: false, reason: "age_outside_40_74" }),
  requiredProfileFields: ["age", "sex", "smokingStatus", "sbp", "knownDiabetes"],
  questions: [
    { id: "totalCholesterol", kind: "number", textKey: "check.cvdLab.cholesterol.q", helpKey: "check.cvdLab.cholesterol.help", min: 0.1, max: 1000, allowUnknown: true },
    {
      id: "cholesterolUnit",
      kind: "choice",
      textKey: "check.cvdLab.unit.q",
      options: [
        { value: "mmol/L", labelKey: "check.cvdLab.unit.mmol" },
        { value: "mg/dL", labelKey: "check.cvdLab.unit.mgdl" },
      ],
    },
    {
      id: "glucoseTest",
      kind: "choice",
      textKey: "check.cvdLab.glucose.q",
      helpKey: "check.cvdLab.glucose.help",
      options: [
        { value: "high", labelKey: "check.cvdLab.glucose.high" },
        { value: "normal", labelKey: "check.cvdLab.glucose.normal" },
        { value: "not_tested", labelKey: "check.cvdLab.glucose.notTested" },
      ],
    },
  ],
  redFlags: () => false, // urgent symptoms are handled by the shared urgent screen before the profile
  score: (a, p) => {
    // Diabetes per Table 2 footnote †: FPG ≥7.0 mmol/L, 2-h PG ≥11.1 mmol/L, HbA1c ≥6.5%, or known diabetes.
    const diabetes = p.knownDiabetes || a.glucoseTest === "high" ? true : a.glucoseTest === "normal" ? false : null;
    const raw = typeof a.totalCholesterol === "number" ? a.totalCholesterol : null;
    const unit: CholUnit = a.cholesterolUnit === "mg/dL" ? "mg/dL" : "mmol/L";
    const mmol = raw === null ? null : toMmol(raw, unit);
    if (mmol !== null && (mmol < TC_PLAUSIBLE_MMOL.min || mmol > TC_PLAUSIBLE_MMOL.max))
      return unavailable("cholesterol_check_unit", "results.nextSteps.cholesterol_test");

    const r = calculateWhoCvdLab({ age: p.age, sex: p.sex, smoker: isCurrentSmoker(p), sbp: p.sbp, totalCholesterolMmol: mmol, diabetes });
    if (!r.available) {
      const next: Record<typeof r.reason, string> = {
        bp_unknown: "results.nextSteps.check_bp",
        diabetes_unknown: "results.nextSteps.glucose_test",
        cholesterol_unknown: "results.nextSteps.cholesterol_test",
        age_out_of_range: "results.nextSteps.healthy_habits",
      };
      return unavailable(r.reason, next[r.reason]);
    }

    const veryHighCholesterol = mmol !== null && mmol >= TC_TREATMENT_MMOL;
    return {
      score: r.riskPercent,
      band: r.band,
      // TODO(VERIFY): raising urgency to "high" for TC ≥ 8 mmol/L is SokhaPheap's rule, based on Table 3 listing it for drug treatment.
      urgency: veryHighCholesterol ? "high" : URGENCY[r.band],
      factors: [],
      nextStepKey: veryHighCholesterol ? "results.nextSteps.cholesterol_very_high" : NEXT_STEP[r.band],
      facilityType: "health_centre",
      details: { groups: r.groups, cholesterolMmol: Math.round(mmol! * 10) / 10, veryHighCholesterol },
    };
  },
  bands: {
    ...Object.fromEntries((Object.keys(en.results.cvdBands) as CvdBand[]).map((b) => [b, { en: en.results.cvdBands[b], km: km.results.cvdBands[b] }])),
    unavailable: { en: en.results.cvdUnavailable.bp_unknown, km: km.results.cvdUnavailable.bp_unknown },
    ...Object.fromEntries(
      (Object.keys(en.results.cvdLabUnavailable) as (keyof typeof en.results.cvdLabUnavailable)[]).map((k) => [
        `unavailable:${k}`,
        { en: en.results.cvdLabUnavailable[k], km: km.results.cvdLabUnavailable[k] },
      ]),
    ),
  },
  references: ["R-WHO-HEARTS-2020"],
  // Table 3 gives band-specific intervals (12 months for <5%, 3-monthly above that), not one interval for the module.
  monitorIntervalMonths: null,
};
