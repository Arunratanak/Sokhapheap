/**
 * Kidney function (eGFR) from a creatinine result, CKD-EPI 2021 race-free equation (Inker et al., NEJM 2021).
 * Stages and thresholds quoted from the same paper (PDF page 3): "guideline-recommended GFR stages (<30, 30 to 44,
 * 45 to 59, 60 to 89, and >90 ml per minute per 1.73 m²)"; "CKD was defined as an eGFR of less than 60 … or persistent
 * albuminuria"; "key thresholds for clinical decision making (60, 45, and 30 ml per minute per 1.73 m²)".
 * One value is never called a diagnosis.
 * Method card: docs/references/methods/egfr/METHOD_CARD.md
 */
import { creatinineToMgdl, egfrCkdEpi2021, gfrStage, type CreatinineUnit, type GfrStage } from "@/domain/scoring/ckdEpi2021";
import type { ModuleDefinition, ModuleResult, Urgency } from "../types";

/**
 * Plausible serum creatinine in mg/dL. Outside it the number almost certainly doesn't match the unit chosen
 * (e.g. 90 entered as mg/dL), so we ask the user to check instead of scoring.
 * TODO(VERIFY): clinician to confirm the range (not from the source).
 */
export const SCR_PLAUSIBLE_MGDL = { min: 0.1, max: 20 } as const;

// TODO(VERIFY): urgency per stage is SokhaPheap's rule (the paper names 60, 45 and 30 as decision thresholds).
const URGENCY: Record<GfrStage, Urgency> = { ">=90": "low", "60-89": "low", "45-59": "moderate", "30-44": "high", "<30": "high" };
const NEXT: Record<GfrStage, string> = {
  ">=90": "egfr_60_plus",
  "60-89": "egfr_60_plus",
  "45-59": "egfr_below_60",
  "30-44": "egfr_below_60",
  "<30": "egfr_below_30",
};

const unavailable = (reason: string, step: string): ModuleResult => ({
  score: null, band: "unavailable", urgency: "incomplete", factors: [], nextStepKey: `results.nextSteps.${step}`,
  facilityType: "health_centre", details: { reason },
});

export const egfrModule: ModuleDefinition = {
  id: "egfr",
  healthArea: "kidney",
  title: { en: "Kidney function (eGFR) from a creatinine result", km: "មុខងារតម្រងនោម (eGFR) ពីលទ្ធផលគ្រីអាទីនីន" },
  summary: {
    en: "Uses the creatinine number from a blood test to estimate how well your kidneys filter (CKD-EPI 2021).",
    km: "ប្រើលេខគ្រីអាទីនីនពីតេស្តឈាម ដើម្បីប៉ាន់ស្មានថាតម្រងនោមរបស់អ្នកច្រោះបានល្អប៉ុណ្ណា (CKD-EPI 2021)។",
  },
  status: "draft", // TODO(VERIFY): clinician sign-off pending
  sensitivity: "normal",
  optIn: true, // needs a creatinine result most people don't have to hand
  scoreUnit: { en: " mL/min/1.73 m²", km: " mL/min/1.73 m²" },
  eligibility: (p) => (p.age >= 18 ? { eligible: true } : { eligible: false, reason: "age_under_18" }),
  requiredProfileFields: ["age", "sex"],
  questions: [
    { id: "creatinine", kind: "number", textKey: "check.egfr.creatinine.q", helpKey: "check.egfr.creatinine.help", min: 0.01, max: 3000, allowUnknown: true },
    {
      id: "creatinineUnit",
      kind: "choice",
      textKey: "check.egfr.unit.q",
      showIf: (a) => typeof a.creatinine === "number",
      options: [
        { value: "mg/dL", labelKey: "check.egfr.unit.mgdl" },
        { value: "µmol/L", labelKey: "check.egfr.unit.umol" },
      ],
    },
  ],
  redFlags: () => false,
  score: (a, p) => {
    const raw = typeof a.creatinine === "number" ? a.creatinine : null;
    if (raw === null) return unavailable("creatinine_unknown", "creatinine_test");
    const unit: CreatinineUnit = a.creatinineUnit === "µmol/L" ? "µmol/L" : "mg/dL";
    const scr = creatinineToMgdl(raw, unit);
    if (scr < SCR_PLAUSIBLE_MGDL.min || scr > SCR_PLAUSIBLE_MGDL.max) return unavailable("creatinine_check_unit", "creatinine_test");
    const egfr = Math.round(egfrCkdEpi2021(scr, p.age, p.sex));
    const stage = gfrStage(egfr);
    return {
      score: egfr,
      band: stage,
      urgency: URGENCY[stage],
      factors: [],
      nextStepKey: `results.nextSteps.${NEXT[stage]}`,
      facilityType: "health_centre",
      details: { creatinineMgdl: Math.round(scr * 100) / 100 },
    };
  },
  bands: {
    ">=90": { en: "eGFR 90 or more", km: "eGFR ៩០ ឬលើស" },
    "60-89": { en: "eGFR 60 to 89", km: "eGFR ៦០ ដល់ ៨៩" },
    "45-59": { en: "eGFR 45 to 59: below 60", km: "eGFR ៤៥ ដល់ ៥៩៖ ក្រោម ៦០" },
    "30-44": { en: "eGFR 30 to 44: below 60", km: "eGFR ៣០ ដល់ ៤៤៖ ក្រោម ៦០" },
    "<30": { en: "eGFR below 30", km: "eGFR ក្រោម ៣០" },
    unavailable: { en: "This check needs a creatinine result from a blood test.", km: "ការពិនិត្យនេះត្រូវការលទ្ធផលគ្រីអាទីនីនពីតេស្តឈាម។" },
    "unavailable:creatinine_check_unit": {
      en: "This creatinine number does not match the unit you chose. Check the unit printed on your lab report and try again.",
      km: "លេខគ្រីអាទីនីននេះមិនត្រូវនឹងឯកតាដែលអ្នកបានជ្រើសរើសទេ។ សូមពិនិត្យឯកតាដែលបោះពុម្ពនៅលើលទ្ធផលតេស្តរបស់អ្នក ហើយព្យាយាមម្តងទៀត។",
    },
  },
  references: ["R-CKD-EPI-2021"],
  monitorIntervalMonths: null, // the source gives no recheck interval
};
