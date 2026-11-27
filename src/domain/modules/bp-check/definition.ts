/**
 * Blood pressure check: reads the profile's latest reading against the archived WHO guideline
 *   WHO. Guideline for the pharmacological treatment of hypertension in adults (2021, ISBN 9789240033986).
 *   - Rec. 1 (PDF pages 9–10, 19): treatment for confirmed hypertension at SBP ≥140 or DBP ≥90; at SBP 130–139 with
 *     existing CVD (recommends) or with high CVD risk, diabetes or CKD (suggests).
 *   - Implementation remark (PDF page 19): "If blood pressure level is high (e.g. systolic ≥160 mmHg or diastolic
 *     ≥100 mmHg) … initiation of treatment should be started without delay."
 *   - Rec. 6 (PDF pages 10–11): target <140/90; SBP <130 with known CVD (recommends) or diabetes / CKD (suggests).
 *   - Rec. 7 (PDF page 11): monthly follow-up after starting or changing medicines until target; every 3–6 months
 *     when controlled.
 *   - Scope (PDF page 14): the guideline "does not address measurement of blood pressure or diagnosis of
 *     hypertension" — a "confirmed" diagnosis is "such as … elevated on two different days" — and "does not
 *     address hypertensive crisis". So one reading is never called a diagnosis, and there is NO emergency level.
 *   - Pregnancy (section 4.3, PDF pages 34–35): diagnosed at ≥140 and/or ≥90 "on at least two occasions"; must be
 *     "diagnosed, treated (when appropriate), and followed up diligently".
 * Method card: docs/references/methods/bp-check/METHOD_CARD.md
 */
import type { ModuleDefinition, ModuleResult, Urgency } from "../types";

export const BP = { high: { sbp: 140, dbp: 90 }, treatWithoutDelay: { sbp: 160, dbp: 100 }, highRiskSbp: 130 } as const;

export const bpCheckModule: ModuleDefinition = {
  id: "bp_check",
  healthArea: "heart",
  title: { en: "Blood pressure check", km: "ការពិនិត្យសម្ពាធឈាម" },
  summary: {
    en: "Compares your latest blood pressure reading with the WHO 2021 hypertension guideline.",
    km: "ប្រៀបធៀបលទ្ធផលវាស់សម្ពាធឈាមចុងក្រោយរបស់អ្នក ជាមួយគោលការណ៍ណែនាំរបស់ WHO ឆ្នាំ ២០២១ ស្តីពីជំងឺលើសសម្ពាធឈាម។",
  },
  status: "draft", // TODO(VERIFY): clinician sign-off pending
  sensitivity: "normal",
  // The guideline is for adults; the profile is 18+.
  eligibility: () => ({ eligible: true }),
  requiredProfileFields: ["sbp", "dbp", "bpMedication", "knownHighBp", "knownHeartDisease", "knownDiabetes", "knownKidneyDisease", "pregnant"],
  questions: [],
  // The guideline does not address hypertensive crisis, so this module has no red flag of its own.
  // Urgent symptoms (chest pain, fainting, …) are handled by the shared urgent screen.
  redFlags: () => false,
  score: (_a, p) => {
    const onTreatment = p.bpMedication || p.knownHighBp; // a confirmed diagnosis (or treatment) already exists
    const highRisk = p.knownHeartDisease || p.knownDiabetes || p.knownKidneyDisease;
    const r = (band: string, urgency: Urgency, step: string): ModuleResult => ({
      score: null, band, urgency, factors: [], nextStepKey: `results.nextSteps.${step}`, facilityType: "health_centre",
      details: { sbp: p.sbp, dbp: p.dbp, onTreatment, highRisk },
    });
    if (p.sbp === null) return r("unavailable", "incomplete", "check_bp");
    const dbp = p.dbp ?? 0; // bottom number unknown → judge on the top number alone

    const high = p.sbp >= BP.high.sbp || dbp >= BP.high.dbp;
    if (p.pregnant === true && high) return r("pregnancy_high", "high", "bp_pregnancy");
    if (p.sbp >= BP.treatWithoutDelay.sbp || dbp >= BP.treatWithoutDelay.dbp) return r("very_high", "high", "bp_very_high");
    if (high) return onTreatment ? r("above_target", "moderate", "bp_above_target") : r("high", "moderate", "bp_recheck");
    if (highRisk && p.sbp >= BP.highRiskSbp)
      return onTreatment ? r("above_target_130", "moderate", "bp_above_target_130") : r("high_risk_130", "moderate", "bp_high_risk_130");
    return onTreatment ? r("at_target", "low", "bp_at_target") : r("below_140_90", "low", "bp_below");
  },
  bands: {
    very_high: { en: "Very high: 160/100 or more", km: "ខ្ពស់ខ្លាំង៖ ១៦០/១០០ ឬលើស" },
    high: { en: "High reading: 140/90 or more", km: "លទ្ធផលខ្ពស់៖ ១៤០/៩០ ឬលើស" },
    pregnancy_high: { en: "High reading in pregnancy: 140/90 or more", km: "លទ្ធផលខ្ពស់ពេលមានផ្ទៃពោះ៖ ១៤០/៩០ ឬលើស" },
    above_target: { en: "Above your treatment target (140/90)", km: "លើសគោលដៅព្យាបាលរបស់អ្នក (១៤០/៩០)" },
    above_target_130: { en: "Above your treatment target (top number 130)", km: "លើសគោលដៅព្យាបាលរបស់អ្នក (លេខខាងលើ ១៣០)" },
    high_risk_130: { en: "130–139: worth discussing with a health worker", km: "១៣០–១៣៩៖ គួរពិភាក្សាជាមួយបុគ្គលិកសុខាភិបាល" },
    at_target: { en: "At your treatment target", km: "ស្ថិតក្នុងគោលដៅព្យាបាលរបស់អ្នក" },
    below_140_90: { en: "Below 140/90", km: "ក្រោម ១៤០/៩០" },
    unavailable: {
      en: "Enter a blood pressure reading to use this check. Health centres and many pharmacies can measure it.",
      km: "សូមបញ្ចូលលទ្ធផលវាស់សម្ពាធឈាម ដើម្បីប្រើការពិនិត្យនេះ។ មណ្ឌលសុខភាព និងឱសថស្ថានជាច្រើនអាចវាស់បាន។",
    },
  },
  references: ["R-WHO-HTN-2021"],
  monitorIntervalMonths: null, // Rec. 7 intervals apply to people on treatment only; shown in the next-step text
};
