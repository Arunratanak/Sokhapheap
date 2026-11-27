/**
 * Reference ranges for common blood tests, used ONLY when the lab report does not print its own range.
 *
 * VERIFIED_BY: TODO(VERIFY) — every entry below needs sign-off from a doctor or nurse before launch.
 * Values were taken from the cited guidelines; they are not invented. Entries with no single
 * guideline range (random glucose, creatinine) have low/high = null, so the app relies on the
 * range printed on the report, or returns "could_not_read".
 */

export type LabTestId =
  | "fasting_glucose"
  | "random_glucose"
  | "hba1c"
  | "total_cholesterol"
  | "ldl"
  | "hdl"
  | "triglycerides"
  | "creatinine";

export type LabFlag = "normal" | "outside_range" | "could_not_read";

export interface LabRange {
  id: LabTestId;
  name: { en: string; km: string };
  aliases: string[]; // lower-case strings labs commonly print
  /** Canonical unit used for low/high. */
  unit: string;
  /** Other accepted units → factor to multiply by to get the canonical unit. */
  conversions: Record<string, number>;
  low: number | null; // inclusive lower bound of "normal" (null = no lower limit)
  high: number | null; // upper bound of "normal" (see highInclusive)
  /** true: value === high is normal (e.g. "≤"); false: must be strictly below high (e.g. "<150"). */
  highInclusive: boolean;
  sexSpecific?: boolean;
  source: string;
  verified: boolean;
}

// Unit conversions (chemistry, molar mass):
// glucose 1 mmol/L = 18.016 mg/dL; cholesterol (TC/LDL/HDL) 1 mmol/L = 38.67 mg/dL;
// triglycerides 1 mmol/L = 88.57 mg/dL; creatinine 1 mg/dL = 88.42 µmol/L;
// HbA1c NGSP % = IFCC mmol/mol / 10.929 + 2.15 (handled separately in toCanonical).
const GLUCOSE = { "mg/dl": 1, "mmol/l": 18.016 };
const CHOL = { "mg/dl": 1, "mmol/l": 38.67 };
const TG = { "mg/dl": 1, "mmol/l": 88.57 };

const ADA = "ADA Standards of Care in Diabetes 2026, Section 2, Table 2.2 (Diabetes Care 2026;49(Suppl 1)) — prediabetes starts at FPG 100 mg/dL / A1C 5.7%";
const ATP3 = "NCEP Adult Treatment Panel III (NHLBI 2001/2002), ATP III classification of LDL, total and HDL cholesterol and triglycerides";

export const LAB_RANGES: Record<LabTestId, LabRange> = {
  fasting_glucose: {
    id: "fasting_glucose",
    name: { en: "Fasting blood glucose", km: "ជាតិស្ករក្នុងឈាមពេលតមអាហារ" },
    aliases: ["fasting glucose", "fasting blood sugar", "fbs", "fbg", "fpg", "glucose (fasting)", "glycemia a jeun", "glycémie à jeun", "gaj"],
    unit: "mg/dL",
    conversions: GLUCOSE,
    low: null, // TODO(VERIFY): hypoglycaemia lower limit not set — rely on printed range
    high: 100,
    highInclusive: false, // normal < 100 mg/dL
    source: ADA,
    verified: false,
  },
  random_glucose: {
    id: "random_glucose",
    name: { en: "Random blood glucose", km: "ជាតិស្ករក្នុងឈាមពេលណាក៏បាន" },
    aliases: ["random glucose", "random blood sugar", "rbs", "rbg", "glucose (random)", "glycemia", "glycémie", "blood glucose", "glucose"],
    unit: "mg/dL",
    conversions: GLUCOSE,
    low: null,
    high: null, // TODO(VERIFY): no guideline "normal range" for random glucose — needs clinician decision
    highInclusive: false,
    source: "No single guideline normal range; ADA uses ≥200 mg/dL with symptoms as a diagnostic criterion (not a normal limit).",
    verified: false,
  },
  hba1c: {
    id: "hba1c",
    name: { en: "HbA1c", km: "អេម៉ូក្លូប៊ីន A1c (HbA1c)" },
    aliases: ["hba1c", "a1c", "hb a1c", "glycated haemoglobin", "glycated hemoglobin", "glycosylated hemoglobin", "hemoglobin a1c"],
    unit: "%",
    conversions: { "%": 1 }, // mmol/mol handled in toCanonical
    low: null,
    high: 5.7,
    highInclusive: false, // normal < 5.7 %
    source: ADA,
    verified: false,
  },
  total_cholesterol: {
    id: "total_cholesterol",
    name: { en: "Total cholesterol", km: "កូឡេស្តេរ៉ុលសរុប" },
    aliases: ["total cholesterol", "cholesterol total", "cholesterol", "tc", "t-chol", "cholestérol total"],
    unit: "mg/dL",
    conversions: CHOL,
    low: null,
    high: 200,
    highInclusive: false, // desirable < 200 mg/dL
    source: ATP3,
    verified: false,
  },
  ldl: {
    id: "ldl",
    name: { en: "LDL cholesterol", km: "កូឡេស្តេរ៉ុល LDL" },
    aliases: ["ldl", "ldl-c", "ldl cholesterol", "ldl-cholesterol", "low density lipoprotein", "ldl calculated", "ldl (calc)"],
    unit: "mg/dL",
    conversions: CHOL,
    low: null,
    high: 100,
    highInclusive: false, // optimal < 100 mg/dL (ATP III). TODO(VERIFY): some labs print < 130
    source: ATP3,
    verified: false,
  },
  hdl: {
    id: "hdl",
    name: { en: "HDL cholesterol", km: "កូឡេស្តេរ៉ុល HDL" },
    aliases: ["hdl", "hdl-c", "hdl cholesterol", "hdl-cholesterol", "high density lipoprotein"],
    unit: "mg/dL",
    conversions: CHOL,
    low: 40, // low HDL < 40 mg/dL (ATP III). TODO(VERIFY): many labs use ≥ 50 for women
    high: null,
    highInclusive: true,
    source: ATP3,
    verified: false,
  },
  triglycerides: {
    id: "triglycerides",
    name: { en: "Triglycerides", km: "ទ្រីគ្លីសេរីដ" },
    aliases: ["triglycerides", "triglyceride", "tg", "trig", "triglycérides"],
    unit: "mg/dL",
    conversions: TG,
    low: null,
    high: 150,
    highInclusive: false, // normal < 150 mg/dL
    source: ATP3,
    verified: false,
  },
  creatinine: {
    id: "creatinine",
    name: { en: "Creatinine", km: "គ្រីអាទីនីន" },
    aliases: ["creatinine", "creat", "cr", "serum creatinine", "créatinine", "creatinine (serum)"],
    unit: "mg/dL",
    conversions: { "mg/dl": 1, "µmol/l": 1 / 88.42, "umol/l": 1 / 88.42, "μmol/l": 1 / 88.42 },
    low: null,
    high: null, // TODO(VERIFY): lab- and sex-specific; no single guideline range — rely on printed range
    highInclusive: true,
    sexSpecific: true,
    source: "Lab-specific (method and sex dependent). Use the range printed on the report.",
    verified: false,
  },
};

export function normaliseUnit(unit: string | null | undefined): string {
  return (unit ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

/** Find a test by the name printed on the report. */
export function matchTest(printedName: string): LabTestId | null {
  const n = printedName.trim().toLowerCase().replace(/\s+/g, " ");
  if (!n) return null;
  // Exact alias first, then "contains" (longest alias wins) — "fasting glucose" must beat "glucose".
  for (const r of Object.values(LAB_RANGES)) if (r.aliases.includes(n)) return r.id;
  let best: { id: LabTestId; len: number } | null = null;
  for (const r of Object.values(LAB_RANGES))
    for (const a of r.aliases)
      if (a.length >= 3 && n.includes(a) && (!best || a.length > best.len)) best = { id: r.id, len: a.length };
  return best?.id ?? null;
}

/** Convert a value to the test's canonical unit. Returns null if the unit is not recognised. */
export function toCanonical(id: LabTestId, value: number, unit: string | null | undefined): number | null {
  const r = LAB_RANGES[id];
  const u = normaliseUnit(unit);
  if (id === "hba1c") {
    if (u === "%" || u === "") return value;
    if (u === "mmol/mol") return value / 10.929 + 2.15;
    return null;
  }
  const factor = r.conversions[u];
  return factor === undefined ? null : value * factor;
}

export interface ExtractedLabValue {
  test_name: string;
  value: number | null;
  unit: string | null;
  printed_range_low: number | null;
  printed_range_high: number | null;
  confidence: number; // 0–1
}

export interface EvaluatedLabValue {
  testId: LabTestId | null;
  name: { en: string; km: string } | null;
  printedName: string;
  value: number | null;
  unit: string | null;
  flag: LabFlag;
  /** "low" | "high" when outside the range. */
  direction?: "low" | "high";
  rangeUsed: { low: number | null; high: number | null; unit: string; source: "report" | "table" } | null;
  reason?: "low_confidence" | "unknown_test" | "no_value" | "unknown_unit" | "no_reference_range";
}

export const MIN_CONFIDENCE = 0.7;

export function evaluateLabValue(v: ExtractedLabValue): EvaluatedLabValue {
  const base = { printedName: v.test_name, value: v.value, unit: v.unit };
  const testId = matchTest(v.test_name);
  const name = testId ? LAB_RANGES[testId].name : null;
  const fail = (reason: EvaluatedLabValue["reason"]): EvaluatedLabValue => ({
    ...base, testId, name, flag: "could_not_read", rangeUsed: null, reason,
  });

  if (v.confidence < MIN_CONFIDENCE) return fail("low_confidence");
  if (!testId) return fail("unknown_test");
  if (v.value === null || !Number.isFinite(v.value)) return fail("no_value");

  // 1) Prefer the report's own printed range (same unit as the value, no conversion needed).
  if (v.printed_range_low !== null || v.printed_range_high !== null) {
    const lo = v.printed_range_low;
    const hi = v.printed_range_high;
    const below = lo !== null && v.value < lo;
    const above = hi !== null && v.value > hi;
    return {
      ...base, testId, name,
      flag: below || above ? "outside_range" : "normal",
      direction: below ? "low" : above ? "high" : undefined,
      rangeUsed: { low: lo, high: hi, unit: v.unit ?? "", source: "report" },
    };
  }

  // 2) Fall back to our table (convert to canonical unit).
  const r = LAB_RANGES[testId];
  if (r.low === null && r.high === null) return fail("no_reference_range");
  const canon = toCanonical(testId, v.value, v.unit);
  if (canon === null) return fail("unknown_unit");
  const below = r.low !== null && canon < r.low;
  const above = r.high !== null && (r.highInclusive ? canon > r.high : canon >= r.high);
  return {
    ...base, testId, name,
    flag: below || above ? "outside_range" : "normal",
    direction: below ? "low" : above ? "high" : undefined,
    rangeUsed: { low: r.low, high: r.high, unit: r.unit, source: "table" },
  };
}
