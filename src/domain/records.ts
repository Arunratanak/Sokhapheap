import { z } from "zod";
import type { RiskResult } from "./risk";
import type { CardResult } from "./modules/registry";
import type { EvaluatedLabValue } from "./scoring/labRanges";

/**
 * Saved records ("My records"), shared by the website and the Telegram bot.
 *
 * A record keeps only the RESULT summary (bands, scores, flags, i18n keys), never the answers,
 * and no text in a particular language: the web page and the bot render it in whatever language
 * the person is using. The same schema validates what the browser sends and what the bot saves.
 */

export const RECORD_KINDS = ["health_check", "risk", "lab"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

const key = z.string().min(1).max(120);
const URGENCIES = ["red_flag", "high", "moderate", "low", "incomplete"] as const;
const FINDRISC_BANDS = ["low", "slightly_elevated", "moderate", "high", "very_high"] as const;
const CVD_BANDS = ["<5", "5-10", "10-20", "20-30", ">=30"] as const;
const CVD_REASONS = ["age_out_of_range", "bp_unknown", "bmi_unknown"] as const;
const NEXT_STEPS = ["see_doctor_soon", "glucose_test", "check_bp", "healthy_habits"] as const;
const LAB_TESTS = ["fasting_glucose", "random_glucose", "hba1c", "total_cholesterol", "ldl", "hdl", "triglycerides", "creatinine"] as const;
const LAB_FLAGS = ["normal", "outside_range", "could_not_read"] as const;

export const healthCheckDataSchema = z.object({
  cards: z
    .array(
      z.object({
        moduleId: z.string().min(1).max(40),
        redFlag: z.boolean(),
        urgency: z.enum(URGENCIES),
        band: z.string().max(60).nullable(),
        /** details.reason when band is "unavailable" (e.g. bp_unknown). */
        reason: z.string().max(60).nullable(),
        score: z.number().finite().nullable(),
        factors: z.array(z.string().max(60)).max(10),
        nextStepKey: key.nullable(),
      }),
    )
    .min(1)
    .max(30),
});

export const riskDataSchema = z.object({
  findrisc: z.object({
    score: z.number().int().min(0).max(26),
    scoreMax: z.number().int().min(0).max(26),
    band: z.enum(FINDRISC_BANDS),
    bmi: z.number().finite().nullable(),
  }),
  cvd: z.object({ band: z.enum(CVD_BANDS).nullable(), reason: z.enum(CVD_REASONS).nullable() }),
  factors: z.array(z.string().max(60)).max(10),
  nextStep: z.enum(NEXT_STEPS),
});

export const labDataSchema = z.object({
  values: z
    .array(
      z.object({
        testId: z.enum(LAB_TESTS).nullable(),
        printedName: z.string().max(80),
        value: z.number().finite().nullable(),
        unit: z.string().max(20).nullable(),
        flag: z.enum(LAB_FLAGS),
        direction: z.enum(["low", "high"]).nullable(),
      }),
    )
    .min(1)
    .max(30),
});

export const recordInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("health_check"), data: healthCheckDataSchema }),
  z.object({ kind: z.literal("risk"), data: riskDataSchema }),
  z.object({ kind: z.literal("lab"), data: labDataSchema }),
]);
export type RecordInput = z.infer<typeof recordInputSchema>;
export type HealthCheckData = z.infer<typeof healthCheckDataSchema>;
export type RiskData = z.infer<typeof riskDataSchema>;
export type LabData = z.infer<typeof labDataSchema>;

/** A saved record as the API and bot return it. */
export type SavedRecord = RecordInput & { id: string; createdAt: string; channel: "web" | "bot" };

// ---------------------------------------------------------------- builders (same on web and bot)

export function healthCheckRecord(cards: CardResult[]): RecordInput {
  return {
    kind: "health_check",
    data: {
      cards: cards.map((c) => ({
        moduleId: c.moduleId,
        redFlag: c.redFlag,
        urgency: c.redFlag || !c.result ? "red_flag" : c.result.urgency,
        band: c.result?.band ?? null,
        reason: c.result?.band === "unavailable" && c.result.details?.reason != null ? String(c.result.details.reason).slice(0, 60) : null,
        score: c.result?.score ?? null,
        factors: (c.result?.factors ?? []).slice(0, 3).map((f) => f.factor),
        nextStepKey: c.result?.nextStepKey ?? null,
      })),
    },
  };
}

export function riskRecord(r: Pick<RiskResult, "findrisc" | "cvd" | "nextStep">): RecordInput {
  return {
    kind: "risk",
    data: {
      findrisc: { score: r.findrisc.score, scoreMax: r.findrisc.scoreMax, band: r.findrisc.band, bmi: r.findrisc.bmi ?? null },
      cvd: r.cvd.available ? { band: r.cvd.band, reason: null } : { band: null, reason: r.cvd.reason },
      factors: r.findrisc.factors.slice(0, 3).map((f) => f.factor),
      nextStep: r.nextStep,
    },
  };
}

export function labRecord(results: EvaluatedLabValue[]): RecordInput {
  return {
    kind: "lab",
    data: {
      values: results.slice(0, 30).map((r) => ({
        testId: r.testId,
        printedName: r.printedName.slice(0, 80),
        value: r.value,
        unit: r.unit?.slice(0, 20) ?? null,
        flag: r.flag,
        direction: r.direction ?? null,
      })),
    },
  };
}
