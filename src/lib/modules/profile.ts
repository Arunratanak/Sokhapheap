import { z } from "zod";

/**
 * Shared health profile: asked ONCE and reused by every module.
 * Derived values (BMI, current smoker, pack-years) are calculated in code, never asked.
 */
export const profileSchema = z.object({
  age: z.number().int().min(18).max(120),
  sex: z.enum(["male", "female"]),
  heightCm: z.number().min(100).max(230),
  weightKg: z.number().min(25).max(300),
  /** null = "I don't know". */
  waistCm: z.number().min(40).max(200).nullable(),
  smokingStatus: z.enum(["never", "former", "current"]),
  /** Cigarettes per day (current or former smokers), null if unknown or not applicable. */
  cigarettesPerDay: z.number().int().min(0).max(100).nullable(),
  /** Years smoked, null if unknown or not applicable. */
  smokingYears: z.number().int().min(0).max(90).nullable(),
  /** Latest blood pressure reading (mmHg), null if unknown. */
  sbp: z.number().int().min(60).max(300).nullable(),
  dbp: z.number().int().min(30).max(200).nullable(),
  bpMedication: z.boolean(),
  knownDiabetes: z.boolean(),
  knownHighBp: z.boolean(),
  knownHeartDisease: z.boolean(),
  knownKidneyDisease: z.boolean(),
  /** Family history of diabetes (FINDRISC wording: second degree = grandparent/aunt/uncle/first cousin). */
  familyDiabetes: z.enum(["none", "second_degree", "first_degree"]),
  /** Only asked to women aged 15–49; null when not asked or prefer not to say. */
  pregnant: z.boolean().nullable(),
  province: z.string().max(60).nullable(),
  district: z.string().max(60).nullable(),
});
export type Profile = z.infer<typeof profileSchema>;

export function bmi(p: Pick<Profile, "heightCm" | "weightKg">): number {
  const m = p.heightCm / 100;
  return p.weightKg / (m * m);
}

export const isCurrentSmoker = (p: Pick<Profile, "smokingStatus">) => p.smokingStatus === "current";

/** Pack-years = (cigarettes per day / 20) × years smoked; null if either is unknown. */
export function packYears(p: Pick<Profile, "cigarettesPerDay" | "smokingYears" | "smokingStatus">): number | null {
  if (p.smokingStatus === "never") return 0;
  if (p.cigarettesPerDay === null || p.smokingYears === null) return null;
  return (p.cigarettesPerDay / 20) * p.smokingYears;
}

/** Pregnancy is only asked to women of child-bearing age (15–49). */
export const asksPregnancy = (p: Pick<Profile, "sex" | "age">) => p.sex === "female" && p.age >= 15 && p.age <= 49;

/** Every profile field, in form order (used to prove modules never re-ask profile questions). */
export const PROFILE_FIELDS = Object.keys(profileSchema.shape) as (keyof Profile)[];
