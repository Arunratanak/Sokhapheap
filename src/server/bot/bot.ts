import "server-only";
import { Bot, InlineKeyboard, Keyboard, type Context } from "grammy";
import { fmt, getRawDictionary, type Locale } from "../../i18n";
import { runRiskCheck, type RiskResult } from "../../domain/risk";
import { riskInputSchema } from "../../domain/schemas";
import { saveScreening } from "../db/screenings";
import { explain } from "../ai/explain";
import { extractLabValues } from "../ai/extract";
import { evaluateLabValue, type EvaluatedLabValue, type ExtractedLabValue } from "../../domain/scoring/labRanges";
import { nearestLocal } from "../data/facilities";
import { areaSummary, matchProvinceName, type AreaSummary } from "../insights/area";
import { getServiceClient } from "../db/supabase";
import { WAIST_INCHES, waistInchesToCm } from "@/domain/units";
import { handleHealthCallback, handleHealthText, startHealthCheck, type HealthCheckState } from "./healthCheck";
import { answerLogin, findPendingLogin, LOGIN_START_PREFIX, logoutEverywhere } from "../auth/telegramLogin";
import { deleteAllRecords, listRecords } from "../db/records";
import { labRecord, riskRecord } from "../../domain/records";
import { bilingual, formatRecordsMessage, saveBotRecord } from "./records";

/**
 * Telegram bot. Same scoring, explanation and lab logic as the web app — no duplicated rules.
 * Conversation state is kept in memory per chat (lost if the free Render service restarts).
 */

type Answers = Record<string, unknown>;
interface Session {
  lang: Locale;
  step: string | null;
  answers: Answers;
  lab?: ExtractedLabValue[];
  /** Multi-screening health check in progress (src/server/bot/healthCheck.ts). */
  hc?: HealthCheckState;
  /** true once the person picked English or Khmer (asked on the first /start). */
  langChosen?: boolean;
  touched: number;
}

const sessions = new Map<number, Session>();
const SESSION_TTL = 60 * 60 * 1000;

export function getSession(chatId: number): Session {
  const now = Date.now();
  for (const [k, s] of sessions) if (now - s.touched > SESSION_TTL) sessions.delete(k);
  let s = sessions.get(chatId);
  if (!s) {
    s = { lang: "km", step: null, answers: {}, touched: now };
    sessions.set(chatId, s);
  }
  s.touched = now;
  return s;
}

// ---------- question flow (mirrors the web questionnaire) ----------
type Q =
  | { key: string; kind: "number"; min: number; max: number; prompt: (t: T) => string; allowUnknown?: boolean; integer?: boolean; inches?: boolean }
  | { key: string; kind: "yesno"; prompt: (t: T) => string; info?: (t: T) => string }
  | { key: string; kind: "choice"; prompt: (t: T) => string; options: (t: T) => [string, string][] };
type T = ReturnType<typeof getRawDictionary>;

export const QUESTIONS: Q[] = [
  { key: "sex", kind: "choice", prompt: (t) => t.risk.sex.q, options: (t) => [["male", t.risk.sex.male], ["female", t.risk.sex.female]] },
  { key: "age", kind: "number", min: 18, max: 120, integer: true, prompt: (t) => t.bot.typeAge },
  { key: "heightCm", kind: "number", min: 100, max: 230, prompt: (t) => t.bot.typeHeight },
  { key: "weightKg", kind: "number", min: 25, max: 300, prompt: (t) => t.bot.typeWeight },
  // Asked in inches, stored in cm (src/domain/units.ts).
  { key: "waistCm", kind: "number", min: WAIST_INCHES.min, max: WAIST_INCHES.max, allowUnknown: true, inches: true, prompt: (t) => t.bot.typeWaist },
  { key: "physicallyActive", kind: "yesno", prompt: (t) => t.risk.activity.q },
  { key: "dailyVegFruit", kind: "yesno", prompt: (t) => t.risk.vegFruit.q },
  { key: "bpMedication", kind: "yesno", prompt: (t) => t.risk.bpMeds.q, info: (t) => t.risk.bpMeds.info },
  { key: "highGlucoseHistory", kind: "yesno", prompt: (t) => t.risk.highGlucose.q },
  {
    key: "familyHistory", kind: "choice", prompt: (t) => t.risk.family.q,
    options: (t) => [["none", t.risk.family.none], ["second_degree", t.risk.family.second], ["first_degree", t.risk.family.first]],
  },
  { key: "smoker", kind: "yesno", prompt: (t) => t.risk.smoker.q },
  { key: "sbp", kind: "number", min: 60, max: 300, allowUnknown: true, integer: true, prompt: (t) => t.bot.typeSbp },
];

const KHMER_DIGITS = "០១២៣៤៥៦៧៨៩";
export function parseBotNumber(text: string): number | null {
  const s = text.trim().replace(/[០-៩]/g, (d) => String(KHMER_DIGITS.indexOf(d))).replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

function disclaimer(t: T) {
  return `⚠️ ${t.common.disclaimer}`;
}

function mainMenu(t: T) {
  // Find care is part of every result (the location prompt after it), not a separate menu item.
  return new InlineKeyboard()
    .text(`🩺 ${t.bot.menuHealth}`, "menu:health").row()
    .text(`❤️ ${t.bot.menuCheck}`, "menu:check").row()
    .text(`🩸 ${t.bot.menuLab}`, "menu:lab").row()
    .text(`📒 ${t.bot.menuRecords}`, "menu:records").row()
    .text(`🌐 ${t.bot.menuLanguage}`, "menu:lang");
}

/** English / Khmer picker. The prompt is bilingual because it is shown before a language is chosen. */
function languageKeyboard() {
  return new InlineKeyboard().text("English", "lang:en").text("ខ្មែរ", "lang:km");
}
export const CHOOSE_LANGUAGE = "🌐 Choose your language · ជ្រើសរើសភាសា";

function locationKeyboard(t: T) {
  return new Keyboard().requestLocation(t.bot.sendLocation).resized().oneTime();
}

async function ask(ctx: Context, s: Session, index: number) {
  const t = getRawDictionary(s.lang);
  const q = QUESTIONS[index];
  s.step = q.key;
  const progress = `(${index + 1}/${QUESTIONS.length}) `;
  if (q.kind === "yesno") {
    const kb = new InlineKeyboard().text(t.common.yes, `a:${q.key}:1`).text(t.common.no, `a:${q.key}:0`);
    if (q.info) kb.row().text(`ℹ️ ${t.common.whatIsThis}`, "info:bpmeds");
    await ctx.reply(progress + q.prompt(t), { reply_markup: kb });
  } else if (q.kind === "choice") {
    const kb = new InlineKeyboard();
    for (const [v, label] of q.options(t)) kb.text(label, `a:${q.key}:${v}`).row();
    await ctx.reply(progress + q.prompt(t), { reply_markup: kb });
  } else {
    await ctx.reply(progress + q.prompt(t), {
      reply_markup: q.allowUnknown ? new InlineKeyboard().text(t.common.dontKnow, `a:${q.key}:null`) : undefined,
    });
  }
}

async function next(ctx: Context, s: Session) {
  const i = QUESTIONS.findIndex((q) => q.key === s.step);
  if (i < QUESTIONS.length - 1) return ask(ctx, s, i + 1);
  s.step = null;
  return finishRisk(ctx, s);
}

/** "Your area" summary for the bot — same numbers and wording as the web card (exported for tests). */
export function formatAreaMessage(a: AreaSummary, lang: Locale): string {
  const t = getRawDictionary(lang).area;
  const r = (v: number) => Math.round(v * 10) / 10;
  const lines = [`📊 ${t.title}: ${fmt(t.heading, { district: a.district.name, province: a.province.name }, lang)}`, ""];
  if (a.womenOverweightPct !== null) lines.push(`• ${fmt(t.overweight, { province: a.province.name, pct: r(a.womenOverweightPct) }, lang)} (${t.srcDhs})`);
  if (a.menSmokePct !== null) lines.push(`• ${fmt(t.smoke, { province: a.province.name, pct: r(a.menSmokePct) }, lang)} (${t.srcDhs})`);
  if (a.travelMotorMin !== null && a.pctWalkOver60 !== null)
    lines.push(`• ${fmt(t.travel, { district: a.district.name, min: Math.round(a.travelMotorMin), pct: Math.round(a.pctWalkOver60) }, lang)} (${t.srcTravel})`);
  if (a.nearestHealthCentre?.from === "you")
    lines.push(`• ${fmt(t.nearestYou, { name: (lang === "km" && a.nearestHealthCentre.nameKm) || a.nearestHealthCentre.name, km: r(a.nearestHealthCentre.km) }, lang)}`);
  if (a.nationalHypertensionPct && a.nationalDiabetesPct)
    lines.push(`• ${fmt(t.national, { hyp: r(a.nationalHypertensionPct.value), hypYear: a.nationalHypertensionPct.year, dm: r(a.nationalDiabetesPct.value), dmYear: a.nationalDiabetesPct.year }, lang)} (${t.srcWho})`);
  lines.push("", `ℹ️ ${t.areaNote}`);
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) lines.push(`${fmt(t.seeInsights, { district: a.district.name }, lang)}: ${site.replace(/\/$/, "")}/${lang}/${a.insightsLink}`);
  return lines.join("\n");
}

/** Format a risk result as a Telegram message (exported for tests). */
export function formatRiskMessage(r: RiskResult, lang: Locale): string {
  const t = getRawDictionary(lang);
  const f = r.findrisc;
  const score = f.incomplete.length
    ? fmt(t.results.diabetesScoreRange, { score: f.score, max: f.scoreMax }, lang)
    : fmt(t.results.diabetesScore, { score: f.score }, lang);
  const lines = [
    `📋 ${t.results.title}`,
    "",
    `🩸 ${t.results.diabetesTitle}: ${t.results.findriscBands[f.band]}`,
    `   ${score}`,
    r.cvd.available
      ? `❤️ ${t.results.heartTitle}: ${t.results.cvdBands[r.cvd.band]}`
      : `❤️ ${t.results.heartTitle}: ${t.results.cvdUnavailable[r.cvd.reason]}`,
  ];
  if (f.factors.length) {
    lines.push("", `${t.results.factorsTitle}:`);
    for (const x of f.factors.slice(0, 3)) lines.push(`• ${t.results.factors[x.factor]}`);
  }
  lines.push("", `👉 ${t.results.nextStepTitle}: ${t.results.nextSteps[r.nextStep]}`, "", disclaimer(t));
  return lines.join("\n");
}

async function finishRisk(ctx: Context, s: Session) {
  const t = getRawDictionary(s.lang);
  const parsed = riskInputSchema.safeParse({ ...s.answers, channel: "bot", save: true });
  if (!parsed.success) {
    s.answers = {};
    return ctx.reply(t.common.error);
  }
  const result = runRiskCheck(parsed.data);
  await ctx.reply(formatRiskMessage(result, s.lang));
  void saveScreening(result, { channel: "bot" });
  await saveBotRecord(ctx, s.lang, riskRecord(result));

  const f = result.findrisc;
  const e = await explain({
    lang: s.lang,
    kind: "risk",
    risk: {
      findrisc: { score: f.score, scoreMax: f.scoreMax, band: f.band, factors: f.factors, recommendGlucoseTest: f.recommendGlucoseTest },
      cvd: result.cvd.available ? { available: true, band: result.cvd.band } : { available: false, reason: result.cvd.reason },
    },
  });
  await ctx.reply(`💬 ${e.text}\n\n${disclaimer(t)}`);
  await ctx.reply(t.bot.sendLocationPrompt, { reply_markup: locationKeyboard(t) });
  await ctx.reply(t.bot.remindPrompt, { reply_markup: remindKeyboard(t) });
  s.answers = {};
}

function remindKeyboard(t: T) {
  return new InlineKeyboard().text(t.bot.remind6, "remind:6").text(t.bot.remind12, "remind:12").row().text(t.bot.remindNo, "remind:no");
}

export function addMonths(d: Date, months: number): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
  return x.toISOString().slice(0, 10);
}

export function formatLabMessage(results: EvaluatedLabValue[], lang: Locale): string {
  const t = getRawDictionary(lang);
  const icon = { normal: "✅", outside_range: "⚠️", could_not_read: "❔" } as const;
  const lines = [`🩸 ${t.lab.resultsTitle}`, ""];
  for (const r of results) {
    const name = r.name ? r.name[lang] : r.printedName;
    lines.push(`${icon[r.flag]} ${name}: ${r.value ?? "—"} ${r.unit ?? ""} — ${t.lab.flags[r.flag]}${r.direction ? ` (${t.lab.direction[r.direction]})` : ""}`);
  }
  const outside = results.some((r) => r.flag === "outside_range");
  lines.push("", `👉 ${t.lab.nextSteps[outside ? "lab_follow_up" : "lab_all_normal"]}`, "", disclaimer(t));
  return lines.join("\n");
}

/** Someone opened the website's login link: show the code to match, and ask them to confirm. */
async function askLogin(ctx: Context, s: Session, linkToken: string) {
  const chosen = s.langChosen === true;
  const pending = await findPendingLogin(linkToken);
  if (!pending) return ctx.reply(bilingual((t) => t.bot.loginExpired, s.lang, chosen));
  const t = getRawDictionary(chosen ? s.lang : "km");
  const en = getRawDictionary("en");
  const text = bilingual((tt, l) => fmt(tt.bot.loginAsk, { code: pending.code.split("").join(" ") }, l), s.lang, chosen);
  // Buttons carry the link token (43 chars; callback data may be up to 64 bytes).
  const yes = chosen ? t.bot.loginConfirm : `${t.bot.loginConfirm} · ${en.bot.loginConfirm}`;
  const no = chosen ? t.bot.loginCancel : `${t.bot.loginCancel} · ${en.bot.loginCancel}`;
  return ctx.reply(text, { reply_markup: new InlineKeyboard().text(`✅ ${yes}`, `lg:y:${linkToken}`).row().text(`✖️ ${no}`, `lg:n:${linkToken}`) });
}

// ---------- bot factory ----------
export function createBot(token: string) {
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const s = getSession(ctx.chat.id);
    s.step = null;
    // Website login link: t.me/<bot>?start=login_<token>
    const payload = typeof ctx.match === "string" ? ctx.match.trim() : "";
    if (payload.startsWith(LOGIN_START_PREFIX)) return askLogin(ctx, s, payload.slice(LOGIN_START_PREFIX.length));
    // First visit: ask English or Khmer before anything else.
    if (!s.langChosen) return ctx.reply(CHOOSE_LANGUAGE, { reply_markup: languageKeyboard() });
    const t = getRawDictionary(s.lang);
    await ctx.reply(`${t.bot.welcome}\n\n${disclaimer(t)}`, { reply_markup: mainMenu(t) });
  });

  bot.command("help", async (ctx) => {
    const t = getRawDictionary(getSession(ctx.chat.id).lang);
    await ctx.reply(`${t.bot.help}\n\n${disclaimer(t)}`);
  });

  bot.command("language", (ctx) => ctx.reply(CHOOSE_LANGUAGE, { reply_markup: languageKeyboard() }));

  const startCheck = async (ctx: Context) => {
    const s = getSession(ctx.chat!.id);
    const t = getRawDictionary(s.lang);
    s.answers = {};
    s.hc = undefined;
    s.step = "urgent";
    await ctx.reply(t.bot.urgentQ, {
      reply_markup: new InlineKeyboard().text(t.bot.urgentYes, "urgent:yes").row().text(t.bot.urgentNo, "urgent:no"),
    });
  };
  const startLab = async (ctx: Context) => {
    const s = getSession(ctx.chat!.id);
    s.step = "lab";
    await ctx.reply(getRawDictionary(s.lang).bot.labPrompt);
  };
  const startNear = async (ctx: Context) => {
    const t = getRawDictionary(getSession(ctx.chat!.id).lang);
    await ctx.reply(t.bot.sendLocationPrompt, { reply_markup: locationKeyboard(t) });
  };

  bot.command("check", startCheck);
  bot.command("health", (ctx) => startHealthCheck(ctx, getSession(ctx.chat.id)));
  bot.command("lab", startLab);
  bot.command("near", startNear);
  bot.command("area", async (ctx) => {
    const s = getSession(ctx.chat.id);
    const t = getRawDictionary(s.lang);
    s.step = "area";
    await ctx.reply(t.bot.areaPrompt, { reply_markup: locationKeyboard(t) });
  });
  bot.command("remind", async (ctx) => {
    const t = getRawDictionary(getSession(ctx.chat.id).lang);
    await ctx.reply(t.bot.remindPrompt, { reply_markup: remindKeyboard(t) });
  });
  const showRecords = async (ctx: Context) => {
    const s = getSession(ctx.chat!.id);
    const t = getRawDictionary(s.lang);
    const records = await listRecords(ctx.from!.id);
    if (!records) return ctx.reply(t.common.error);
    const kb = records.length ? new InlineKeyboard().text(`🗑 ${t.bot.recordsDeleteButton}`, "rec:del") : undefined;
    return ctx.reply(formatRecordsMessage(records, s.lang), { reply_markup: kb, link_preview_options: { is_disabled: true } });
  };
  const askDeleteRecords = (ctx: Context) => {
    const t = getRawDictionary(getSession(ctx.chat!.id).lang);
    return ctx.reply(t.bot.recordsDeleteAsk, {
      reply_markup: new InlineKeyboard().text(t.bot.recordsDeleteYes, "rec:del:yes").row().text(t.bot.recordsDeleteNo, "rec:del:no"),
    });
  };
  bot.command("records", showRecords);
  bot.command("deleterecords", askDeleteRecords);
  bot.command("logout", async (ctx) => {
    const t = getRawDictionary(getSession(ctx.chat.id).lang);
    const ok = await logoutEverywhere(ctx.from!.id);
    await ctx.reply(ok ? t.bot.loggedOutEverywhere : t.common.error);
  });

  bot.command("stopremind", async (ctx) => {
    const t = getRawDictionary(getSession(ctx.chat.id).lang);
    await getServiceClient()?.from("reminders").delete().eq("telegram_chat_id", ctx.chat.id).is("sent_at", null);
    await ctx.reply(t.bot.remindStopped);
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const s = getSession(ctx.chat!.id);
    const t = getRawDictionary(s.lang);
    await ctx.answerCallbackQuery();

    if (data === "menu:lang") return ctx.reply(CHOOSE_LANGUAGE, { reply_markup: languageKeyboard() });
    if (data === "lang:en" || data === "lang:km") {
      s.lang = data === "lang:en" ? "en" : "km";
      s.langChosen = true;
      s.step = null;
      s.hc = undefined; // a check in progress was asked in the other language: start fresh
      const tl = getRawDictionary(s.lang);
      return ctx.reply(`${tl.bot.languageChanged}\n\n${tl.bot.welcome}\n\n${disclaimer(tl)}`, { reply_markup: mainMenu(tl) });
    }
    if (data === "menu:health") return startHealthCheck(ctx, s);
    if (data === "menu:check") return startCheck(ctx);
    if (await handleHealthCallback(ctx, s, data)) return;
    if (data === "menu:lab") return startLab(ctx);
    if (data === "menu:near") return startNear(ctx);
    if (data === "menu:records") return showRecords(ctx);
    if (data === "rec:del") return askDeleteRecords(ctx);
    if (data === "rec:del:no") return ctx.reply(t.bot.recordsKept);
    if (data === "rec:del:yes") {
      const ok = await deleteAllRecords(ctx.from.id);
      if (ok) await logoutEverywhere(ctx.from.id);
      return ctx.reply(ok ? t.bot.recordsDeleted : t.common.error);
    }

    // Website login: "lg:y:<token>" confirm / "lg:n:<token>" cancel (buttons from askLogin).
    if (data.startsWith("lg:")) {
      const [, answer, linkToken] = data.split(":");
      const confirm = answer === "y";
      const ok = await answerLogin(linkToken ?? "", { id: ctx.from.id, firstName: ctx.from.first_name }, confirm);
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
      const text = ok ? (confirm ? (tt: T) => tt.bot.loginDone : (tt: T) => tt.bot.loginCancelled) : (tt: T) => tt.bot.loginExpired;
      return ctx.reply(bilingual(text, s.lang, s.langChosen === true));
    }

    if (data === "urgent:yes") {
      s.step = null;
      s.hc = undefined;
      // Same choice as the web "go now" screen: continue the check if safe, or go back to the menu.
      await ctx.reply(`🚑 ${t.urgent.goNowTitle}\n\n${t.urgent.goNowBody}\n\n📞 ${t.urgent.ambulance}`, {
        reply_markup: new InlineKeyboard().text(`✅ ${t.bot.urgentContinue}`, "safe:risk").row().text(`🏠 ${t.bot.backToMenu}`, "menu:home"),
      });
      return ctx.reply(t.bot.sendLocationPrompt, { reply_markup: locationKeyboard(t) });
    }
    if (data === "safe:risk") {
      s.answers = {};
      return ask(ctx, s, 0);
    }
    if (data === "menu:home") {
      s.step = null;
      s.hc = undefined;
      return ctx.reply(`${t.bot.welcome}\n\n${disclaimer(t)}`, { reply_markup: mainMenu(t) });
    }
    if (data === "urgent:no") return ask(ctx, s, 0);

    if (data.startsWith("a:")) {
      const [, key, raw] = data.split(":");
      if (s.step !== key) return; // stale button
      s.answers[key] = raw === "null" ? null : raw === "1" ? true : raw === "0" ? false : raw;
      return next(ctx, s);
    }

    if (data.startsWith("remind:")) {
      const v = data.split(":")[1];
      if (v === "no") return;
      const months = v === "6" ? 6 : 12;
      const remindOn = addMonths(new Date(), months);
      const db = getServiceClient();
      if (!db) return ctx.reply(t.common.error);
      const { error } = await db.from("reminders").insert({
        telegram_chat_id: ctx.chat!.id, remind_on: remindOn, type: months === 6 ? "6_months" : "12_months",
      });
      return ctx.reply(error ? t.common.error : fmt(t.bot.remindSaved, { date: remindOn }, s.lang));
    }

    if (data === "lab:ok" && s.lab) {
      const results = s.lab.map((v) => evaluateLabValue({ ...v, confidence: Math.max(v.confidence, 0.9) }));
      s.lab = undefined;
      await ctx.reply(formatLabMessage(results, s.lang));
      await saveBotRecord(ctx, s.lang, labRecord(results));
      const e = await explain({
        lang: s.lang,
        kind: "lab",
        lab: results.slice(0, 20).map((r) => ({
          test: (r.name ? r.name[s.lang] : r.printedName).slice(0, 60), value: r.value,
          unit: r.unit?.slice(0, 20) ?? null, flag: r.flag, ...(r.direction ? { direction: r.direction } : {}),
        })),
      });
      return ctx.reply(`💬 ${e.text}\n\n${disclaimer(t)}`);
    }
    if (data === "lab:wrong") {
      s.lab = undefined;
      return ctx.reply(t.bot.labWrongHelp);
    }
  });

  bot.on("message:location", async (ctx) => {
    const t = getRawDictionary(getSession(ctx.chat.id).lang);
    const s = getSession(ctx.chat.id);
    const { latitude, longitude } = ctx.message.location;
    if (s.step === "area") s.step = null;
    const list = nearestLocal(latitude, longitude, 3);
    const lines = list.map((f, i) => {
      const name = s.lang === "km" && f.name_km ? f.name_km : f.name;
      const km = (f.distance_m / 1000).toFixed(1);
      return `${i + 1}. ${name}\n   ${t.map.types[f.type]} · ${fmt(t.map.distanceKm, { km }, s.lang)}\n   https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`;
    });
    await ctx.reply(`📍 ${t.map.nearestTitle}\n\n${lines.join("\n\n")}\n\n${t.map.callAhead}`, {
      reply_markup: { remove_keyboard: true },
      link_preview_options: { is_disabled: true },
    });
    // "Your area" summary from open data. The location is used only for this lookup, never stored.
    const area = areaSummary({ lat: latitude, lng: longitude });
    if (area) await ctx.reply(formatAreaMessage(area, s.lang), { link_preview_options: { is_disabled: true } });
  });

  bot.on("message:photo", async (ctx) => {
    const s = getSession(ctx.chat.id);
    const t = getRawDictionary(s.lang);
    await ctx.reply(t.lab.reading);
    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const file = await ctx.api.getFile(photo.file_id);
      const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
      let image: Buffer | null = Buffer.from(await res.arrayBuffer());
      const values = await extractLabValues(image, "image/jpeg");
      image.fill(0);
      image = null; // never stored
      if (!values.length) return ctx.reply(t.lab.nothingFound);
      s.lab = values;
      const preview = values.map((v) => `• ${v.test_name}: ${v.value ?? "?"} ${v.unit ?? ""}`).join("\n");
      await ctx.reply(`${t.bot.labConfirm}\n\n${preview}`, {
        reply_markup: new InlineKeyboard().text(t.bot.labCorrect, "lab:ok").text(t.bot.labWrong, "lab:wrong"),
      });
    } catch {
      await ctx.reply(t.lab.aiUnavailable);
    }
  });

  bot.on("message:text", async (ctx) => {
    const s = getSession(ctx.chat.id);
    const t = getRawDictionary(s.lang);
    if (await handleHealthText(ctx, s, ctx.message.text, parseBotNumber)) return;
    const q = QUESTIONS.find((x) => x.key === s.step);
    if (q?.kind === "number") {
      const n = parseBotNumber(ctx.message.text);
      if (n === null || n < q.min || n > q.max) return ctx.reply(fmt(t.bot.sendNumber, { min: q.min, max: q.max }, s.lang));
      s.answers[q.key] = q.inches ? waistInchesToCm(n) : q.integer ? Math.round(n) : n;
      return next(ctx, s);
    }
    if (s.step === "area") {
      const pcode = matchProvinceName(ctx.message.text);
      const area = pcode ? areaSummary({ province: pcode }) : null;
      if (!area) return ctx.reply(t.bot.areaNotFound);
      s.step = null;
      return ctx.reply(formatAreaMessage(area, s.lang), { reply_markup: { remove_keyboard: true }, link_preview_options: { is_disabled: true } });
    }
    await ctx.reply(t.bot.notUnderstood, { reply_markup: mainMenu(t) });
  });

  bot.catch((err) => console.error("bot error:", err.message));
  return bot;
}

let instance: Bot | null = null;
export function getBot(): Bot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  instance ??= createBot(token);
  return instance;
}
