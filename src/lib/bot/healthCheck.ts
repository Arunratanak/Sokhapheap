import "server-only";
import { InlineKeyboard, Keyboard, type Context } from "grammy";
import { fmt, formatNumber, getRawDictionary, type Locale } from "../i18n";
import { asksPregnancy, profileSchema, type Profile } from "../modules/profile";
import { chooseModules, runModules, visibleModules, type CardResult } from "../modules/registry";
import { questionsToAsk, type Answers as ModuleAnswers, type ModuleDefinition, type ModuleQuestion, type Urgency } from "../modules/types";
import { WAIST_INCHES, waistInchesToCm } from "../units";

/**
 * The multi-screening health check in Telegram. Uses exactly the same module code as the web /check page
 * (profile schema, chooseModules, questionsToAsk, runModules), so both channels give the same results.
 * Same gate as the web: only modules that are public (visibleModules(false)) are offered. Nothing is saved.
 */

type T = ReturnType<typeof getRawDictionary>;

export interface HealthCheckState {
  draft: Record<string, unknown>;
  profile?: Profile;
  selected: string[];
  answers: Record<string, ModuleAnswers>;
}
/** The part of the bot session this flow uses. */
export interface HcSession {
  lang: Locale;
  step: string | null;
  hc?: HealthCheckState;
}

/** Read a dictionary value by dotted path (module questions reference i18n keys). */
function tr(t: T, key: string): string {
  const v = key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), t);
  return typeof v === "string" ? v : key;
}

const modules = (): ModuleDefinition[] => visibleModules(false);

// ---------------------------------------------------------------- 1. profile (asked once)
type PStep =
  | { key: string; kind: "choice"; prompt: (t: T) => string; options: (t: T) => [string, string][]; when?: (d: Record<string, unknown>) => boolean }
  | { key: string; kind: "yesno"; prompt: (t: T) => string; info?: (t: T) => string; when?: (d: Record<string, unknown>) => boolean }
  | { key: string; kind: "number"; prompt: (t: T) => string; min: number; max: number; integer?: boolean; allowUnknown?: boolean; inches?: boolean; when?: (d: Record<string, unknown>) => boolean };

const condition = (k: "knownDiabetes" | "knownHighBp" | "knownHeartDisease" | "knownKidneyDisease") => (t: T) => `${t.check.conditionsQ}\n• ${t.check.conditions[k]}`;

export const PROFILE_STEPS: PStep[] = [
  { key: "sex", kind: "choice", prompt: (t) => t.risk.sex.q, options: (t) => [["male", t.risk.sex.male], ["female", t.risk.sex.female]] },
  { key: "age", kind: "number", min: 18, max: 120, integer: true, prompt: (t) => t.bot.typeAge },
  { key: "heightCm", kind: "number", min: 100, max: 230, prompt: (t) => t.bot.typeHeight },
  { key: "weightKg", kind: "number", min: 25, max: 300, prompt: (t) => t.bot.typeWeight },
  { key: "waistCm", kind: "number", min: WAIST_INCHES.min, max: WAIST_INCHES.max, allowUnknown: true, inches: true, prompt: (t) => t.bot.typeWaist },
  {
    key: "pregnant", kind: "choice", prompt: (t) => t.check.pregnant.q,
    options: (t) => [["no", t.check.pregnant.no], ["yes", t.check.pregnant.yes], ["skip", t.check.pregnant.skip]],
    when: (d) => d.sex === "female" && typeof d.age === "number" && asksPregnancy({ sex: "female", age: d.age }),
  },
  {
    key: "smokingStatus", kind: "choice", prompt: (t) => t.check.smokingStatus.q,
    options: (t) => [["never", t.check.smokingStatus.never], ["former", t.check.smokingStatus.former], ["current", t.check.smokingStatus.current]],
  },
  { key: "sbp", kind: "number", min: 60, max: 300, integer: true, allowUnknown: true, prompt: (t) => t.bot.typeSbp },
  { key: "dbp", kind: "number", min: 30, max: 200, integer: true, allowUnknown: true, prompt: (t) => t.bot.typeDbp, when: (d) => typeof d.sbp === "number" },
  { key: "bpMedication", kind: "yesno", prompt: (t) => t.risk.bpMeds.q, info: (t) => t.risk.bpMeds.info },
  { key: "knownDiabetes", kind: "yesno", prompt: condition("knownDiabetes") },
  { key: "knownHighBp", kind: "yesno", prompt: condition("knownHighBp") },
  { key: "knownHeartDisease", kind: "yesno", prompt: condition("knownHeartDisease") },
  { key: "knownKidneyDisease", kind: "yesno", prompt: condition("knownKidneyDisease") },
  {
    key: "familyDiabetes", kind: "choice", prompt: (t) => t.risk.family.q,
    options: (t) => [["none", t.risk.family.none], ["second_degree", t.risk.family.second], ["first_degree", t.risk.family.first]],
  },
];

const profileSteps = (d: Record<string, unknown>) => PROFILE_STEPS.filter((p) => !p.when || p.when(d));

/** Build and validate the shared profile from the bot answers (same rules as the web form). */
export function buildProfile(d: Record<string, unknown>) {
  const sex = d.sex as Profile["sex"];
  const age = d.age as number;
  return profileSchema.safeParse({
    age, sex, heightCm: d.heightCm, weightKg: d.weightKg, waistCm: d.waistCm ?? null,
    smokingStatus: d.smokingStatus,
    cigarettesPerDay: null, smokingYears: null, // not asked: no module uses them
    sbp: d.sbp ?? null, dbp: typeof d.sbp === "number" ? (d.dbp ?? null) : null,
    bpMedication: d.bpMedication === true,
    knownDiabetes: d.knownDiabetes === true, knownHighBp: d.knownHighBp === true,
    knownHeartDisease: d.knownHeartDisease === true, knownKidneyDisease: d.knownKidneyDisease === true,
    familyDiabetes: d.familyDiabetes,
    pregnant: asksPregnancy({ sex, age }) ? (d.pregnant === "yes" ? true : d.pregnant === "no" ? false : null) : null,
    province: null, district: null,
  });
}

function infoButton(t: T, kb: InlineKeyboard) {
  return kb.row().text(`ℹ️ ${t.common.whatIsThis}`, "info:bpmeds");
}

async function askProfile(ctx: Context, s: HcSession, hc: HealthCheckState) {
  const t = getRawDictionary(s.lang);
  const steps = profileSteps(hc.draft);
  const step = steps.find((p) => !(p.key in hc.draft));
  if (!step) return afterProfile(ctx, s, hc);
  s.step = `hc:p:${step.key}`;
  const progress = `(${steps.indexOf(step) + 1}/${steps.length}) `;
  if (step.kind === "choice") {
    const kb = new InlineKeyboard();
    for (const [v, label] of step.options(t)) kb.text(label, `hp:${step.key}:${v}`).row();
    return ctx.reply(progress + step.prompt(t), { reply_markup: kb });
  }
  if (step.kind === "yesno") {
    const kb = new InlineKeyboard().text(t.common.yes, `hp:${step.key}:1`).text(t.common.no, `hp:${step.key}:0`);
    return ctx.reply(progress + step.prompt(t), { reply_markup: step.info ? infoButton(t, kb) : kb });
  }
  return ctx.reply(progress + step.prompt(t), {
    reply_markup: step.allowUnknown ? new InlineKeyboard().text(t.common.dontKnow, `hp:${step.key}:null`) : undefined,
  });
}

// ---------------------------------------------------------------- 2. choose screenings
function chooseKeyboard(t: T, s: HcSession, hc: HealthCheckState) {
  const kb = new InlineKeyboard();
  for (const c of chooseModules(hc.profile!, modules()).filter((x) => x.eligible)) {
    const on = hc.selected.includes(c.module.id);
    kb.text(`${on ? "✅" : "⬜"} ${c.module.title[s.lang]}`, `hs:t:${c.module.id}`).row();
  }
  return kb.text(t.bot.hcContinue, "hs:go");
}

async function afterProfile(ctx: Context, s: HcSession, hc: HealthCheckState) {
  const t = getRawDictionary(s.lang);
  const parsed = buildProfile(hc.draft);
  if (!parsed.success) {
    s.step = null;
    s.hc = undefined;
    return ctx.reply(t.common.error);
  }
  hc.profile = parsed.data;
  const choices = chooseModules(hc.profile, modules());
  hc.selected = choices.filter((c) => c.preselected).map((c) => c.module.id);
  s.step = "hc:choose";
  const notForYou = choices.filter((c) => !c.eligible);
  const lines = [t.bot.hcChoose];
  if (notForYou.length) {
    lines.push("", `${t.check.notForYou}:`);
    for (const c of notForYou) lines.push(`• ${c.module.title[s.lang]}: ${tr(t, `check.reasons.${c.reason}`)}`);
  }
  return ctx.reply(lines.join("\n"), { reply_markup: chooseKeyboard(t, s, hc) });
}

// ---------------------------------------------------------------- 3. module questions
function nextQuestion(hc: HealthCheckState): { m: ModuleDefinition; q: ModuleQuestion } | null {
  for (const m of modules()) {
    if (!hc.selected.includes(m.id)) continue;
    const a = hc.answers[m.id] ?? {};
    for (const q of questionsToAsk(m.questions, a, hc.profile!)) if (a[q.id] === undefined) return { m, q };
  }
  return null;
}

async function askModuleQuestion(ctx: Context, s: HcSession, hc: HealthCheckState) {
  const t = getRawDictionary(s.lang);
  const next = nextQuestion(hc);
  if (!next) return finish(ctx, s, hc);
  const { m, q } = next;
  s.step = `hc:q:${m.id}:${q.id}`;
  const text = `🩺 ${m.title[s.lang]}\n\n${tr(t, q.textKey)}${q.helpKey ? `\n\n${tr(t, q.helpKey)}` : ""}`;
  const cb = (v: string) => `hq:${m.id}:${q.id}:${v}`;
  if (q.kind === "yesno") return ctx.reply(text, { reply_markup: new InlineKeyboard().text(t.common.yes, cb("1")).text(t.common.no, cb("0")) });
  if (q.kind === "choice") {
    const kb = new InlineKeyboard();
    for (const o of q.options) kb.text(tr(t, o.labelKey), cb(o.value)).row();
    return ctx.reply(text, { reply_markup: kb });
  }
  return ctx.reply(`${text}\n\n${t.bot.typeNumber}`, {
    reply_markup: q.allowUnknown ? new InlineKeyboard().text(t.common.dontKnow, cb("null")) : undefined,
  });
}

// ---------------------------------------------------------------- 4. results
const ICON: Record<Urgency, string> = { red_flag: "🚨", high: "🔴", moderate: "🟠", low: "🟢", incomplete: "⚪" };

/** Results as Telegram text (exported for tests). Same cards, order and wording as the web dashboard. */
export function formatHealthCheckMessage(cards: CardResult[], lang: Locale, hasDrafts: boolean): string[] {
  const t = getRawDictionary(lang);
  const c = t.check;
  const byId = new Map(modules().map((m) => [m.id, m]));
  const blocks: string[] = [];
  const head = [`🩺 ${c.dashboardTitle}`, c.dashboardIntro];
  if (hasDrafts) head.push("", `⚠️ ${c.draftBanner}`);
  blocks.push(head.join("\n"));
  for (const card of cards) {
    const m = byId.get(card.moduleId);
    if (!m) continue;
    const r = card.result;
    const urgency: Urgency = card.redFlag ? "red_flag" : r!.urgency;
    const lines = [`${ICON[urgency]} ${m.title[lang]}`];
    if (card.redFlag || !r) lines.push(c.urgentCard);
    else {
      lines.push(r.band !== "unavailable" ? m.bands[r.band]?.[lang] ?? "" : c.urgency[urgency]);
      if (r.band === "unavailable") lines.push((m.bands[`unavailable:${String(r.details?.reason)}`] ?? m.bands.unavailable)?.[lang] ?? "");
      if (r.score !== null) lines.push(`${c.score}: ${formatNumber(r.score, lang)}${m.scoreUnit?.[lang] ?? ""}`);
      if (r.factors.length) lines.push(`${c.topFactors}: ${r.factors.slice(0, 3).map((f) => tr(t, `results.factors.${f.factor}`)).join(", ")}`);
      lines.push(`👉 ${tr(t, r.nextStepKey)}`);
    }
    blocks.push(lines.filter(Boolean).join("\n"));
  }
  blocks.push(`⚠️ ${t.common.disclaimer}`);
  // Telegram messages are limited to 4096 characters: pack blocks into as few messages as fit.
  const out: string[] = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (last && last.length + b.length + 2 <= 3800) out[out.length - 1] = `${last}\n\n${b}`;
    else out.push(b);
  }
  return out;
}

async function finish(ctx: Context, s: HcSession, hc: HealthCheckState) {
  const t = getRawDictionary(s.lang);
  const list = modules();
  const cards = runModules(hc.profile!, hc.selected, hc.answers, list);
  const hasDrafts = list.some((m) => hc.selected.includes(m.id) && m.status === "draft");
  for (const msg of formatHealthCheckMessage(cards, s.lang, hasDrafts)) await ctx.reply(msg);
  s.step = null;
  s.hc = undefined;
  // Find care is part of the result: offer the nearest facilities (handled by the bot's location handler).
  await ctx.reply(t.bot.sendLocationPrompt, { reply_markup: new Keyboard().requestLocation(t.bot.sendLocation).resized().oneTime() });
}

// ---------------------------------------------------------------- entry points used by bot.ts
export async function startHealthCheck(ctx: Context, s: HcSession) {
  const t = getRawDictionary(s.lang);
  s.hc = { draft: {}, selected: [], answers: {} };
  s.step = "hc:urgent";
  await ctx.reply(t.bot.hcIntro);
  await ctx.reply(t.bot.urgentQ, {
    reply_markup: new InlineKeyboard().text(t.bot.urgentYes, "urgent:yes").row().text(t.bot.urgentNo, "hu:no"),
  });
}

/** "I am safe, continue the check" after the urgent screen: start the profile questions. */
export async function continueHealthCheck(ctx: Context, s: HcSession) {
  s.hc = { draft: {}, selected: [], answers: {} };
  return askProfile(ctx, s, s.hc);
}

/** Handles health-check button presses. Returns true if the callback belonged to this flow. */
export async function handleHealthCallback(ctx: Context, s: HcSession, data: string): Promise<boolean> {
  const t = getRawDictionary(s.lang);
  const hc = s.hc;
  if (data === "info:bpmeds") {
    await ctx.reply(`ℹ️ ${t.risk.bpMeds.info}`);
    return true;
  }
  if (data === "hu:no") {
    if (!hc || s.step !== "hc:urgent") return true;
    await askProfile(ctx, s, hc);
    return true;
  }
  if (data.startsWith("hp:")) {
    const [, key, raw] = data.split(":");
    if (!hc || s.step !== `hc:p:${key}`) return true; // stale button
    hc.draft[key] = raw === "null" ? null : raw === "1" ? true : raw === "0" ? false : raw;
    await askProfile(ctx, s, hc);
    return true;
  }
  if (data.startsWith("hs:")) {
    if (!hc?.profile || s.step !== "hc:choose") return true;
    if (data === "hs:go") {
      if (!hc.selected.length) {
        await ctx.reply(t.bot.hcNoneSelected);
        return true;
      }
      s.step = "hc:questions";
      await askModuleQuestion(ctx, s, hc);
      return true;
    }
    const id = data.slice("hs:t:".length);
    hc.selected = hc.selected.includes(id) ? hc.selected.filter((x) => x !== id) : [...hc.selected, id];
    await ctx.editMessageReplyMarkup({ reply_markup: chooseKeyboard(t, s, hc) }).catch(() => {});
    return true;
  }
  if (data.startsWith("hq:")) {
    const [, mid, qid, ...rest] = data.split(":");
    const raw = rest.join(":");
    if (!hc || s.step !== `hc:q:${mid}:${qid}`) return true;
    (hc.answers[mid] ??= {})[qid] = raw === "null" ? null : raw === "1" ? true : raw === "0" ? false : raw;
    await askModuleQuestion(ctx, s, hc);
    return true;
  }
  return false;
}

/** Handles typed numbers during the health check. Returns true if the message belonged to this flow. */
export async function handleHealthText(ctx: Context, s: HcSession, text: string, parse: (x: string) => number | null): Promise<boolean> {
  const hc = s.hc;
  if (!hc || !s.step?.startsWith("hc:")) return false;
  const t = getRawDictionary(s.lang);
  const n = parse(text);
  const bad = (min: number, max: number) => ctx.reply(fmt(t.bot.sendNumber, { min, max }, s.lang));

  if (s.step.startsWith("hc:p:")) {
    const key = s.step.slice("hc:p:".length);
    const step = PROFILE_STEPS.find((p) => p.key === key);
    if (step?.kind !== "number") {
      await ctx.reply(t.bot.hcUseButtons);
      return true;
    }
    if (n === null || n < step.min || n > step.max) {
      await bad(step.min, step.max);
      return true;
    }
    hc.draft[key] = step.inches ? waistInchesToCm(n) : step.integer ? Math.round(n) : n;
    await askProfile(ctx, s, hc);
    return true;
  }
  if (s.step.startsWith("hc:q:")) {
    const [, , mid, qid] = s.step.split(":");
    const q = modules().find((m) => m.id === mid)?.questions.find((x) => x.id === qid);
    if (q?.kind !== "number") {
      await ctx.reply(t.bot.hcUseButtons);
      return true;
    }
    if (n === null || n < q.min || n > q.max) {
      await bad(q.min, q.max);
      return true;
    }
    (hc.answers[mid] ??= {})[qid] = q.integer ? Math.round(n) : n;
    await askModuleQuestion(ctx, s, hc);
    return true;
  }
  await ctx.reply(t.bot.hcUseButtons);
  return true;
}
