/**
 * WHO 2019 laboratory-based CVD risk (10-year), South-East Asia chart (includes Cambodia).
 * Pure lookup — no AI. Table generated from the archived WHO PDF (see whoCvdLabTable.ts).
 *
 * Inputs and definitions follow Table 2 of the source (HEARTS Risk-based CVD management 2020, PDF page 19):
 *  - smoker = "Current smoker"
 *  - diabetes = "Fasting plasma glucose ≥7.0 mmol/L (126 mg/dL), or 2-h plasma glucose ≥11.1 mmol/L (200 mg/dL),
 *    or HbA1c ≥6.5% or known diabetes"
 *  - "Cholesterol values are to be entered in the chart as mmol/L (To convert mg/dL to mmol/L, multiply by 0.02586.)"
 */
import type { Sex } from "./findrisc";
import { ageGroup, cvdBand, sbpGroup, type CvdBand } from "./whoCvd";
import type { AgeGroup, SbpGroup } from "./whoCvdTable";
import { WHO_CVD_LAB_TABLE, type CholGroup } from "./whoCvdLabTable";

/** Source factor (Table 2 footnote ‡): mg/dL × 0.02586 = mmol/L. */
export const CHOL_MGDL_TO_MMOL = 0.02586;

export type CholUnit = "mmol/L" | "mg/dL";
export type CvdLabUnavailableReason = "age_out_of_range" | "bp_unknown" | "cholesterol_unknown" | "diabetes_unknown";

export interface CvdLabInput {
  age: number;
  sex: Sex;
  smoker: boolean;
  /** Systolic blood pressure, mmHg. null = unknown. */
  sbp: number | null;
  /** Total cholesterol in mmol/L. null = unknown. */
  totalCholesterolMmol: number | null;
  /** Diabetes per the source definition. null = unknown (never tested and no known diabetes). */
  diabetes: boolean | null;
}

export type CvdLabResult =
  | {
      available: true;
      riskPercent: number;
      band: CvdBand;
      groups: { age: AgeGroup; sbp: SbpGroup; cholesterol: CholGroup; diabetes: boolean };
    }
  | { available: false; reason: CvdLabUnavailableReason };

export function toMmol(value: number, unit: CholUnit): number {
  return unit === "mg/dL" ? value * CHOL_MGDL_TO_MMOL : value;
}

/**
 * Chart columns: <4, 4-4.9, 5-5.9, 6-6.9, ≥7 mmol/L.
 * Interpreted as half-open intervals [4,5), [5,6), [6,7) for values between the printed limits
 * (e.g. 4.95 → "4-4.9"), the same rule as the BMI columns of the non-lab chart.
 * TODO(VERIFY): confirm boundary handling with a clinician.
 */
export function cholesterolColumn(mmol: number): { index: number; group: CholGroup } {
  if (mmol < 4) return { index: 0, group: "<4" };
  if (mmol < 5) return { index: 1, group: "4-4.9" };
  if (mmol < 6) return { index: 2, group: "5-5.9" };
  if (mmol < 7) return { index: 3, group: "6-6.9" };
  return { index: 4, group: ">=7" };
}

export function calculateWhoCvdLab(input: CvdLabInput): CvdLabResult {
  const age = ageGroup(input.age);
  if (!age) return { available: false, reason: "age_out_of_range" };
  if (input.sbp === null || !Number.isFinite(input.sbp)) return { available: false, reason: "bp_unknown" };
  if (input.diabetes === null) return { available: false, reason: "diabetes_unknown" };
  if (input.totalCholesterolMmol === null || !Number.isFinite(input.totalCholesterolMmol) || input.totalCholesterolMmol <= 0)
    return { available: false, reason: "cholesterol_unknown" };

  const sbp = sbpGroup(input.sbp);
  const chol = cholesterolColumn(input.totalCholesterolMmol);
  const riskPercent =
    WHO_CVD_LAB_TABLE[input.diabetes ? "diabetes" : "noDiabetes"][input.sex][input.smoker ? "smoker" : "nonSmoker"][age][sbp][chol.index];
  return { available: true, riskPercent, band: cvdBand(riskPercent), groups: { age, sbp, cholesterol: chol.group, diabetes: input.diabetes } };
}
