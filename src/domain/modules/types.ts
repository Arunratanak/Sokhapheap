/**
 * Health module system (Health Modules Phase 1).
 *
 * A module is ONE validated screening tool (or official guideline) for ONE condition.
 * Rules (see SokhaPheap_HealthModules_Prompt.md):
 *  - score() is a pure function: no AI, no network, no randomness.
 *  - Questions, points, cut-offs and ranges come from the archived source (docs/references/methods/<id>/METHOD_CARD.md),
 *    never from memory.
 *  - Only `clinician_verified` modules are visible in production, unless PUBLISH_DRAFT_MODULES is on (registry.ts);
 *    drafts are always visible with ?preview=1 on localhost.
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

/**
 * A question the module asks in addition to the shared profile. Text is an i18n key path (e.g. "risk.activity.q").
 * `showIf`: ask only when it applies (e.g. the unit only after a number was entered); hidden questions are not required.
 */
type QuestionBase = { id: string; textKey: string; helpKey?: string; showIf?: (answers: Answers, profile: Profile) => boolean };
export type ModuleQuestion =
  | (QuestionBase & { kind: "yesno" })
  | (QuestionBase & { kind: "choice"; options: { value: string; labelKey: string }[] })
  | (QuestionBase & { kind: "number"; unitKey?: string; min: number; max: number; integer?: boolean; allowUnknown?: boolean });

/** The questions of a module that apply to this person and their answers so far. */
export function questionsToAsk(questions: ModuleQuestion[], answers: Answers, profile: Profile): ModuleQuestion[] {
  return questions.filter((q) => !q.showIf || q.showIf(answers, profile));
}

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
  /** true = shown but not pre-selected (e.g. needs a lab result most people don't have to hand). */
  optIn?: boolean;
  /** Unit shown after the numeric score on the dashboard (e.g. "%"). */
  scoreUnit?: Text;
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
  /** Reference IDs, see docs/references/methods/<id>/METHOD_CARD.md. */
  references: string[];
  /** Suggested recheck interval in months, FROM THE SOURCE GUIDELINE, or null if the source gives none. */
  monitorIntervalMonths: number | null;
}
