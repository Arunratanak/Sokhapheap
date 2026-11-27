import { z } from "zod";

export const sexSchema = z.enum(["male", "female"]);

export const riskInputSchema = z.object({
  age: z.number().int().min(18).max(120),
  sex: sexSchema,
  heightCm: z.number().min(100).max(230),
  weightKg: z.number().min(25).max(300),
  waistCm: z.number().min(40).max(200).nullable(),
  physicallyActive: z.boolean(),
  dailyVegFruit: z.boolean(),
  bpMedication: z.boolean(),
  highGlucoseHistory: z.boolean(),
  familyHistory: z.enum(["none", "second_degree", "first_degree"]),
  smoker: z.boolean(),
  /** Systolic BP in mmHg, or null if unknown. */
  sbp: z.number().int().min(60).max(300).nullable(),
  province: z.string().max(60).nullable().optional(),
  orgCode: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/).nullable().optional(),
  channel: z.enum(["web", "bot"]).default("web"),
  /** Demo/test runs are not saved. */
  save: z.boolean().default(true),
});
export type RiskInput = z.infer<typeof riskInputSchema>;

export const langSchema = z.enum(["km", "en"]);

export const explainInputSchema = z.object({
  lang: langSchema,
  kind: z.enum(["risk", "lab"]),
  // Only the scoring result — never raw personal data.
  risk: z
    .object({
      findrisc: z.object({
        score: z.number().int().min(0).max(26),
        scoreMax: z.number().int().min(0).max(26),
        band: z.enum(["low", "slightly_elevated", "moderate", "high", "very_high"]),
        factors: z.array(z.object({ factor: z.string().max(40), points: z.number().int().min(0).max(5) })).max(8),
        recommendGlucoseTest: z.boolean(),
      }),
      cvd: z.union([
        z.object({ available: z.literal(true), band: z.enum(["<5", "5-10", "10-20", "20-30", ">=30"]) }),
        z.object({ available: z.literal(false), reason: z.enum(["age_out_of_range", "bp_unknown", "bmi_unknown"]) }),
      ]),
    })
    .optional(),
  lab: z
    .array(
      z.object({
        test: z.string().max(60),
        value: z.number().nullable(),
        unit: z.string().max(20).nullable(),
        flag: z.enum(["normal", "outside_range", "could_not_read"]),
        direction: z.enum(["low", "high"]).optional(),
      }),
    )
    .max(20)
    .optional(),
});
export type ExplainInput = z.infer<typeof explainInputSchema>;

export const extractedLabValueSchema = z.object({
  test_name: z.string().max(80),
  value: z.number().nullable(),
  unit: z.string().max(20).nullable(),
  printed_range_low: z.number().nullable(),
  printed_range_high: z.number().nullable(),
  confidence: z.number().min(0).max(1),
});
export const extractedLabArraySchema = z.array(extractedLabValueSchema).max(40);

export const labEvaluateInputSchema = z.object({ values: extractedLabArraySchema.min(1) });

export const nearestQuerySchema = z.object({
  lat: z.coerce.number().min(9.5).max(15),
  lng: z.coerce.number().min(102).max(108),
  limit: z.coerce.number().int().min(1).max(50).default(5),
  type: z.enum(["hospital", "health_centre", "health_post", "clinic", "other"]).optional(),
});

export const byAreaQuerySchema = z.object({
  province: z.string().min(1).max(60),
  district: z.string().max(60).optional(),
});
