/**
 * Module registry + the clinician gate.
 * `clinician_verified` modules are always shown. Drafts are shown in preview (?preview=1, localhost only)
 * and, while PUBLISH_DRAFT_MODULES is true, on the public site too, always with the "not yet reviewed
 * by a doctor" banner and a Draft tag (see CheckFlow).
 */
import { findriscModule } from "./findrisc/definition";
import { whoCvdModule } from "./who-cvd/definition";
import { whoCvdLabModule } from "./who-cvd-lab/definition";
import { tbSymptomModule } from "./tb-symptom/definition";
import { bpCheckModule } from "./bp-check/definition";
import { egfrModule } from "./egfr/definition";
import type { Profile } from "./profile";
import { HEALTH_AREAS, URGENCY_ORDER, type Answers, type ModuleDefinition, type ModuleResult } from "./types";

export const MODULES: ModuleDefinition[] = [bpCheckModule, whoCvdModule, whoCvdLabModule, findriscModule, egfrModule, tbSymptomModule];

/**
 * Publish draft (not yet clinician-reviewed) modules on the public site.
 * Decision by the project owner, 24 Nov 2026, against the recommendation to wait for clinician sign-off.
 * Safeguards that stay on: a "not yet reviewed by a doctor" banner on every health-check screen, a Draft tag
 * on each draft module, the urgent-symptom screen first, and the "not a diagnosis" disclaimer.
 * Set to false to hide drafts again (they stay available in localhost preview).
 */
export const PUBLISH_DRAFT_MODULES = true;

/** Modules a viewer may see: verified ones, plus drafts when preview is on or drafts are published. */
export function visibleModules(preview: boolean, all: ModuleDefinition[] = MODULES, publishDrafts: boolean = PUBLISH_DRAFT_MODULES): ModuleDefinition[] {
  return all.filter((m) => m.status === "clinician_verified" || preview || publishDrafts);
}

/** Preview (?preview=1) only works on localhost — never on the public site. */
export function previewAllowed(host: string | null | undefined, query: string | string[] | undefined): boolean {
  const on = query === "1" || (Array.isArray(query) && query.includes("1"));
  const h = (host ?? "").toLowerCase().split(":")[0];
  return on && (h === "localhost" || h === "127.0.0.1" || h === "[::1]");
}

export interface ModuleChoice {
  module: ModuleDefinition;
  eligible: boolean;
  reason?: string;
  /** Core modules are pre-selected; sensitive and `optIn` modules start unselected. */
  preselected: boolean;
}

export function chooseModules(profile: Profile, modules: ModuleDefinition[]): ModuleChoice[] {
  return modules.map((m) => {
    const e = m.eligibility(profile);
    return { module: m, eligible: e.eligible, reason: e.reason, preselected: e.eligible && m.sensitivity === "normal" && !m.optIn };
  });
}

export interface CardResult {
  moduleId: string;
  healthArea: ModuleDefinition["healthArea"];
  redFlag: boolean;
  result: ModuleResult | null;
}

/**
 * Run the selected modules. Ineligible modules are never scored. A red flag in ANY module
 * is reported first (the UI stops and shows urgent guidance before any score).
 */
export function runModules(profile: Profile, selected: string[], answers: Record<string, Answers>, modules: ModuleDefinition[]): CardResult[] {
  const out: CardResult[] = [];
  for (const m of modules) {
    if (!selected.includes(m.id) || !m.eligibility(profile).eligible) continue;
    const a = answers[m.id] ?? {};
    const redFlag = m.redFlags(a, profile);
    out.push({ moduleId: m.id, healthArea: m.healthArea, redFlag, result: redFlag ? null : m.score(a, profile) });
  }
  return sortByUrgency(out);
}

/** Sort: red flags → high → moderate → low → incomplete; ties by health area order, then module id. */
export function sortByUrgency(cards: CardResult[]): CardResult[] {
  const rank = (c: CardResult) => URGENCY_ORDER.indexOf(c.redFlag ? "red_flag" : c.result?.urgency ?? "incomplete");
  return [...cards].sort((a, b) => rank(a) - rank(b) || HEALTH_AREAS.indexOf(a.healthArea) - HEALTH_AREAS.indexOf(b.healthArea) || a.moduleId.localeCompare(b.moduleId));
}

/** The questions a module still needs: its own questions only (profile fields are never re-asked). */
export function extraQuestions(m: ModuleDefinition) {
  return m.questions;
}
