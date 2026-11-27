/**
 * FINDRISC — Finnish Diabetes Risk Score (0–26 points).
 * Points and bands exactly as specified in the SokhaPheap build prompt (original FINDRISC,
 * Lindström & Tuomilehto, Diabetes Care 2003).
 * Pure functions only — risk is calculated by code, never by AI.
 */

export type Sex = "male" | "female";
export type FamilyHistory = "none" | "second_degree" | "first_degree";
export type FindriscBand = "low" | "slightly_elevated" | "moderate" | "high" | "very_high";
export type FindriscFactor =
  | "age"
  | "bmi"
  | "waist"
  | "physical_activity"
  | "diet"
  | "bp_medication"
  | "high_glucose_history"
  | "family_history";

export interface FindriscInput {
  age: number; // years
  sex: Sex;
  heightCm: number;
  weightKg: number;
  /** null = "I don't know" — score is then a lower bound (see `incomplete`). */
  waistCm: number | null;
  physicallyActive: boolean; // ≥30 min physical activity daily
  dailyVegFruit: boolean; // vegetables, fruit or berries every day
  bpMedication: boolean; // ever taken blood pressure medication
  highGlucoseHistory: boolean; // ever had high blood glucose
  familyHistory: FamilyHistory; // second_degree = grandparent/aunt/uncle/first cousin; first_degree = parent/sibling/own child
}

export interface FindriscResult {
  score: number;
  /** Highest possible score if the unknown answers were the worst case (equals score when complete). */
  scoreMax: number;
  band: FindriscBand;
  bandMax: FindriscBand;
  bmi: number;
  factors: { factor: FindriscFactor; points: number }[];
  incomplete: FindriscFactor[];
  recommendGlucoseTest: boolean;
}

/**
 * All cut-offs in one place.
 * `standard` = original FINDRISC cut-offs (used by default).
 * `asian` = placeholder for Asian-specific BMI/waist cut-offs. Changing cut-offs without
 * re-validating the points is not established, so it stays disabled until a clinician approves it.
 */
export const FINDRISC_CUTOFFS = {
  standard: {
    /** BMI: < low → 0 · low–high → 1 · > high → 3 */
    bmi: { low: 25, high: 30 },
    /** Waist (cm): < low → 0 · low–high → 3 · > high → 4 */
    waist: { male: { low: 94, high: 102 }, female: { low: 80, high: 88 } },
  },
  asian: {
    enabled: false,
    // TODO(VERIFY): Asian-specific values need a published, validated source and clinician sign-off.
    // Candidate sources to review: WHO Expert Consultation, Lancet 2004;363:157–63 (Asian BMI action
    // points); IDF consensus worldwide definition of the metabolic syndrome (2006) (ethnic waist cut-offs).
    // Do NOT fill these in without verification.
    bmi: null as { low: number; high: number } | null,
    waist: null as { male: { low: number; high: number }; female: { low: number; high: number } } | null,
  },
} as const;

export type CutoffProfile = "standard" | "asian";

export function calculateBmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function findriscBand(score: number): FindriscBand {
  if (score < 7) return "low";
  if (score <= 11) return "slightly_elevated";
  if (score <= 14) return "moderate";
  if (score <= 20) return "high";
  return "very_high";
}

function agePoints(age: number): number {
  if (age < 45) return 0;
  if (age <= 54) return 2;
  if (age <= 64) return 3;
  return 4;
}

function getCutoffs(profile: CutoffProfile) {
  if (profile === "standard") return FINDRISC_CUTOFFS.standard;
  const a = FINDRISC_CUTOFFS.asian;
  if (!a.enabled || !a.bmi || !a.waist) {
    throw new Error("Asian FINDRISC cut-offs are not verified yet (TODO(VERIFY)).");
  }
  return { bmi: a.bmi, waist: a.waist };
}

export function validateFindriscInput(i: FindriscInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(i.age) || i.age < 18 || i.age > 120) errors.push("age must be 18–120");
  if (!Number.isFinite(i.heightCm) || i.heightCm < 100 || i.heightCm > 230) errors.push("heightCm must be 100–230");
  if (!Number.isFinite(i.weightKg) || i.weightKg < 25 || i.weightKg > 300) errors.push("weightKg must be 25–300");
  if (i.waistCm !== null && (!Number.isFinite(i.waistCm) || i.waistCm < 40 || i.waistCm > 200))
    errors.push("waistCm must be 40–200 or null");
  return errors;
}

export function calculateFindrisc(input: FindriscInput, profile: CutoffProfile = "standard"): FindriscResult {
  const errors = validateFindriscInput(input);
  if (errors.length) throw new RangeError(errors.join("; "));
  const c = getCutoffs(profile);

  const bmi = calculateBmi(input.heightCm, input.weightKg);
  const bmiPts = bmi < c.bmi.low ? 0 : bmi <= c.bmi.high ? 1 : 3;

  const incomplete: FindriscFactor[] = [];
  let waistPts = 0;
  if (input.waistCm === null) incomplete.push("waist");
  else {
    const w = c.waist[input.sex];
    waistPts = input.waistCm < w.low ? 0 : input.waistCm <= w.high ? 3 : 4;
  }

  const factors: { factor: FindriscFactor; points: number }[] = [
    { factor: "age", points: agePoints(input.age) },
    { factor: "bmi", points: bmiPts },
    { factor: "waist", points: waistPts },
    { factor: "physical_activity", points: input.physicallyActive ? 0 : 2 },
    { factor: "diet", points: input.dailyVegFruit ? 0 : 1 },
    { factor: "bp_medication", points: input.bpMedication ? 2 : 0 },
    { factor: "high_glucose_history", points: input.highGlucoseHistory ? 5 : 0 },
    {
      factor: "family_history",
      points: input.familyHistory === "first_degree" ? 5 : input.familyHistory === "second_degree" ? 3 : 0,
    },
  ];

  const score = factors.reduce((s, f) => s + f.points, 0);
  const scoreMax = score + (incomplete.includes("waist") ? 4 : 0);

  return {
    score,
    scoreMax,
    band: findriscBand(score),
    bandMax: findriscBand(scoreMax),
    bmi: Math.round(bmi * 10) / 10,
    factors: factors.filter((f) => f.points > 0).sort((a, b) => b.points - a.points),
    incomplete,
    recommendGlucoseTest: score >= 12,
  };
}
