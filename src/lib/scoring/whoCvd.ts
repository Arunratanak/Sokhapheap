/**
 * WHO 2019 non-laboratory-based CVD risk (10-year), South-East Asia chart (includes Cambodia).
 * Pure lookup — no AI. Table generated from the official WHO PDF (see whoCvdTable.ts).
 */
import type { Sex } from "./findrisc";
import { WHO_CVD_TABLE, type AgeGroup, type SbpGroup } from "./whoCvdTable";

export type CvdBand = "<5" | "5-10" | "10-20" | "20-30" | ">=30";
export type CvdUnavailableReason = "age_out_of_range" | "bp_unknown" | "bmi_unknown";

export interface CvdInput {
  age: number;
  sex: Sex;
  smoker: boolean;
  /** Systolic blood pressure, mmHg. null = unknown. */
  sbp: number | null;
  bmi: number | null;
}

export type CvdResult =
  | {
      available: true;
      riskPercent: number;
      band: CvdBand;
      groups: { age: AgeGroup; sbp: SbpGroup; bmiColumn: number };
    }
  | { available: false; reason: CvdUnavailableReason };

export function ageGroup(age: number): AgeGroup | null {
  if (!Number.isFinite(age) || age < 40 || age >= 75) return null;
  const lo = 40 + Math.floor((Math.floor(age) - 40) / 5) * 5;
  return `${lo}-${lo + 4}` as AgeGroup;
}

/** WHO chart rows: <120, 120-139, 140-159, 160-179, ≥180 mmHg. */
export function sbpGroup(sbp: number): SbpGroup {
  if (sbp < 120) return "<120";
  if (sbp < 140) return "120-139";
  if (sbp < 160) return "140-159";
  if (sbp < 180) return "160-179";
  return ">=180";
}

/**
 * WHO chart columns: <20, 20-24, 25-29, 30-35, ≥35 kg/m².
 * Interpreted as half-open intervals [20,25), [25,30), [30,35), ≥35 for non-integer BMI.
 * TODO(VERIFY): confirm boundary handling for non-integer BMI with a clinician (see REVIEW.md).
 */
export function bmiColumn(bmi: number): number {
  if (bmi < 20) return 0;
  if (bmi < 25) return 1;
  if (bmi < 30) return 2;
  if (bmi < 35) return 3;
  return 4;
}

/** Risk level legend from the WHO chart: <5%, 5% to <10%, 10% to <20%, 20% to <30%, ≥30%. */
export function cvdBand(percent: number): CvdBand {
  if (percent < 5) return "<5";
  if (percent < 10) return "5-10";
  if (percent < 20) return "10-20";
  if (percent < 30) return "20-30";
  return ">=30";
}

export function calculateWhoCvd(input: CvdInput): CvdResult {
  const age = ageGroup(input.age);
  if (!age) return { available: false, reason: "age_out_of_range" };
  if (input.sbp === null || !Number.isFinite(input.sbp)) return { available: false, reason: "bp_unknown" };
  if (input.bmi === null || !Number.isFinite(input.bmi)) return { available: false, reason: "bmi_unknown" };

  const sbp = sbpGroup(input.sbp);
  const col = bmiColumn(input.bmi);
  const riskPercent = WHO_CVD_TABLE[input.sex][input.smoker ? "smoker" : "nonSmoker"][age][sbp][col];
  return { available: true, riskPercent, band: cvdBand(riskPercent), groups: { age, sbp, bmiColumn: col } };
}
