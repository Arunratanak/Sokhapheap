/**
 * CKD-EPI 2021 creatinine equation (race-free), eGFRcr(AS).
 * Source (archived locally, copyrighted, not redistributed): Inker LA et al. New creatinine- and cystatin C–based
 * equations to estimate GFR without race. N Engl J Med 2021;385:1737–49. Table 2, PDF page 5 (journal p. 1741),
 * row "2021 CKD-EPI creatinine (2009 CKD-EPI creatinine fit without race); eGFRcr(AS), new":
 *   intercept μ = 142; a1 = F −0.241 / M −0.302; a2 = −1.200; age coefficient c = 0.9938; female d = 1.012.
 * Footnote *: eGFR = μ × min(Scr/κ, 1)^a1 × max(Scr/κ, 1)^a2 × c^Age × d [if female]; κ = 0.7 (female), 0.9 (male).
 * Units: Scr in mg/dL; "To convert the values for serum creatinine to micromoles per liter, multiply by 88.4" (PDF page 4).
 * Pure function — no AI.
 */
import type { Sex } from "./findrisc";

export const CKD_EPI_2021 = {
  mu: 142,
  kappa: { female: 0.7, male: 0.9 },
  a1: { female: -0.241, male: -0.302 },
  a2: -1.2,
  age: 0.9938,
  female: 1.012,
} as const;

/** Paper, Table 1 footnote: mg/dL × 88.4 = µmol/L. */
export const CREATININE_UMOL_PER_MGDL = 88.4;

export type CreatinineUnit = "mg/dL" | "µmol/L";

export function creatinineToMgdl(value: number, unit: CreatinineUnit): number {
  return unit === "µmol/L" ? value / CREATININE_UMOL_PER_MGDL : value;
}

/** eGFR in mL/min/1.73 m², unrounded. */
export function egfrCkdEpi2021(scrMgdl: number, age: number, sex: Sex): number {
  const c = CKD_EPI_2021;
  const ratio = scrMgdl / c.kappa[sex];
  return c.mu * Math.min(ratio, 1) ** c.a1[sex] * Math.max(ratio, 1) ** c.a2 * c.age ** age * (sex === "female" ? c.female : 1);
}

/**
 * "Guideline-recommended GFR stages (<30, 30 to 44, 45 to 59, 60 to 89, and >90 ml per minute per 1.73 m²)"
 * (paper, PDF page 3; the paper's Table 1 uses "≥90"). Applied to the rounded eGFR.
 */
export type GfrStage = ">=90" | "60-89" | "45-59" | "30-44" | "<30";
export function gfrStage(egfr: number): GfrStage {
  if (egfr >= 90) return ">=90";
  if (egfr >= 60) return "60-89";
  if (egfr >= 45) return "45-59";
  if (egfr >= 30) return "30-44";
  return "<30";
}
