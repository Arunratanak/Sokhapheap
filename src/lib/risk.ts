import { calculateFindrisc, type FindriscResult } from "./scoring/findrisc";
import { calculateWhoCvd, type CvdResult } from "./scoring/whoCvd";
import type { RiskInput } from "./schemas";

export interface RiskResult {
  findrisc: FindriscResult;
  cvd: CvdResult;
  nextStep: NextStep;
}

export type NextStep =
  | "see_doctor_soon" // high / very high diabetes risk or CVD ≥ 20%
  | "glucose_test" // FINDRISC ≥ 12
  | "check_bp" // CVD unavailable because BP is unknown
  | "healthy_habits"; // low risk

/** Shared by the web API and the Telegram bot so scores are always identical. */
export function runRiskCheck(input: RiskInput): RiskResult {
  const findrisc = calculateFindrisc(input);
  const cvd = calculateWhoCvd({
    age: input.age,
    sex: input.sex,
    smoker: input.smoker,
    sbp: input.sbp,
    bmi: findrisc.bmi,
  });
  return { findrisc, cvd, nextStep: chooseNextStep(findrisc, cvd) };
}

export function chooseNextStep(f: FindriscResult, cvd: CvdResult): NextStep {
  if (f.band === "high" || f.band === "very_high" || (cvd.available && (cvd.band === "20-30" || cvd.band === ">=30")))
    return "see_doctor_soon";
  if (f.recommendGlucoseTest) return "glucose_test";
  if (!cvd.available && cvd.reason === "bp_unknown") return "check_bp";
  return "healthy_habits";
}
