/**
 * Health module system (Health Modules Phase 1).
 *
 * A module is ONE validated screening tool (or official guideline) for ONE condition.
 * Rules (see SokhaPheap_HealthModules_Prompt.md):
 *  - score() is a pure function: no AI, no network, no randomness.
 *  - Questions, points, cut-offs and ranges come from the archived source (references/methods/<id>/METHOD_CARD.md),
 *    never from memory.
 *  - Only `clinician_verified` modules are visible in production; drafts only with ?preview=1 on localhost.
 */
import type { Profile } from "./profile";

export type HealthArea = "heart" | "metabolic" | "kidney" | "lungs" | "liver" | "mind" | "bones" | "womens_health";
export const HEALTH_AREAS: HealthArea[] = ["heart", "metabolic", "kidney", "lungs", "liver", "mind", "bones", "womens_health"];

export type ModuleStatus = "draft" | "clinician_verified";
export type Sensitivity = "normal" | "sensitive";
export type FacilityType = "health_centre" | "referral_hospital" | "tb_testing" | "mental_health";

/** Urgency used to sort dashboard cards: red flag first, then high → moderate → low → not checked. */
export type Urgency = "red_flag" | "high" | "moderate" | "low" | "incomplete";
export const URGENCY_ORDER: Urgency[] = ["red_flag", "high", "moderate", "low", "incomplete"];

export interface Text { en: string; km: string }

/** A question the module asks in addition to the shared profile. Text is an i18n key path (e.g. "risk.activity.q"). */
export type ModuleQuestion =
  | { id: string; kind: "yesno"; textKey: string; helpKey?: string }
  | { id: string; kind: "choice"; textKey: string; options: { value: string; labelKey: string }[] }
  | { id: string; kind: "number"; textKey: string; unitKey?: string; min: number; max: number; integer?: boolean; allowUnknown?: boolean };

export type Answers = Record<string, string | number | boolean | null>;

export interface Eligibility { eligible: boolean; reason?: string }

export interface ModuleResult {
  /** Numeric score when the tool has one (e.g. FINDRISC points, WHO CVD %), else null. */
  score: number | null;
  /** Band id; labels come from `bands`. "unavailable" = the tool cannot be applied (e.g. BP unknown). */
  band: string;
  urgency: Urgency;
  factors: { factor: string; points?: number }[];
  /** i18n key of the next step text. */
  nextStepKey: string;
  facilityType: FacilityType;
  /** Tool-specific extra details (e.g. score range when an answer is unknown). */
  details?: Record<string, unknown>;
}

export interface ModuleDefinition {
  id: string;
  healthArea: HealthArea;
  title: Text;
  /** One-line description shown on the "choose your screenings" step. */
  summary: Text;
  status: ModuleStatus;
  sensitivity: Sensitivity;
  eligibility: (profile: Profile) => Eligibility;
  /** Shared-profile fields this module uses (the profile asks them once for every module). */
  requiredProfileFields: (keyof Profile)[];
  /** Extra questions only this module needs. */
  questions: ModuleQuestion[];
  /** Answers that must stop the flow and show urgent guidance before any score. */
  redFlags: (answers: Answers, profile: Profile) => boolean;
  score: (answers: Answers, profile: Profile) => ModuleResult;
  /** Band id → label (km/en). Colour + words are shown together. */
  bands: Record<string, Text>;
  /** Reference IDs, see references/methods/<id>/METHOD_CARD.md. */
  references: string[];
  /** Suggested recheck interval in months, FROM THE SOURCE GUIDELINE, or null if the source gives none. */
  monitorIntervalMonths: number | null;
}
