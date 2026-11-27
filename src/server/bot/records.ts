import "server-only";
import type { Context } from "grammy";
import { fmt, formatNumber, getRawDictionary, type Locale } from "../../i18n";
import { MODULES } from "../../domain/modules/registry";
import { LAB_RANGES } from "../../domain/scoring/labRanges";
import type { RecordInput, SavedRecord } from "../../domain/records";
import { saveRecord } from "../db/records";

type T = ReturnType<typeof getRawDictionary>;

/**
 * Results in the bot are saved to the person's records automatically (keyed by their Telegram user ID:
 * the same records the website shows after "Log in with Telegram"). Says so when it worked, and stays
 * quiet if the database is unavailable: saving never blocks a result.
 */
export async function saveBotRecord(ctx: Context, lang: Locale, record: RecordInput): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;
  const id = await saveRecord(userId, "bot", record);
  if (id) await ctx.reply(`💾 ${getRawDictionary(lang).bot.recordSaved}`);
}

const URGENCY_ICON = { red_flag: "🚨", high: "🔴", moderate: "🟠", low: "🟢", incomplete: "⚪" } as const;
const FINDRISC_ICON = { low: "🟢", slightly_elevated: "🟡", moderate: "🟠", high: "🔴", very_high: "🔴" } as const;
const LAB_ICON = { normal: "✅", outside_range: "⚠️", could_not_read: "❔" } as const;

/** 2026-11-27 (Khmer digits in Khmer). Dates are shown in Cambodia time. */
export function recordDate(iso: string, lang: Locale): string {
  const d = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return lang === "km" ? d.replace(/\d/g, (x) => formatNumber(Number(x), "km")) : d;
}

/** One saved record as a few lines of Telegram text (exported for tests). */
export function formatRecord(r: SavedRecord, lang: Locale): string {
  const t = getRawDictionary(lang);
  const head = `📅 ${recordDate(r.createdAt, lang)} · ${t.records.kinds[r.kind]}`;
  const lines = [head];
  if (r.kind === "health_check") {
    const byId = new Map(MODULES.map((m) => [m.id, m]));
    for (const c of r.data.cards) {
      const m = byId.get(c.moduleId);
      if (!m) continue;
      const label = c.redFlag ? t.check.urgency.red_flag : c.band && c.band !== "unavailable" ? (m.bands[c.band]?.[lang] ?? "") : t.check.urgency[c.urgency];
      lines.push(`${URGENCY_ICON[c.urgency]} ${m.title[lang]}: ${label}`);
    }
  } else if (r.kind === "risk") {
    const { findrisc, cvd } = r.data;
    lines.push(`${FINDRISC_ICON[findrisc.band]} ${t.results.diabetesTitle}: ${t.results.findriscBands[findrisc.band]} (${fmt(t.results.diabetesScore, { score: findrisc.score }, lang)})`);
    lines.push(`❤️ ${t.results.heartTitle}: ${cvd.band ? t.results.cvdBands[cvd.band] : t.results.cvdUnavailable[cvd.reason ?? "bp_unknown"]}`);
  } else {
    for (const v of r.data.values) {
      const name = v.testId ? LAB_RANGES[v.testId].name[lang] : v.printedName;
      const value = v.value === null ? "—" : `${formatNumber(v.value, lang, 2)} ${v.unit ?? ""}`.trim();
      lines.push(`${LAB_ICON[v.flag]} ${name}: ${value} — ${t.lab.flags[v.flag]}${v.direction ? ` (${t.lab.direction[v.direction]})` : ""}`);
    }
  }
  return lines.join("\n");
}

/** The /records reply: newest first, packed under Telegram's 4096-character limit (exported for tests). */
export function formatRecordsMessage(records: SavedRecord[], lang: Locale, siteUrl = process.env.NEXT_PUBLIC_SITE_URL): string {
  const t = getRawDictionary(lang);
  if (!records.length) return t.bot.recordsEmpty;
  const header = `📒 ${t.records.title}`;
  const link = siteUrl ? `\n\n${fmt(t.bot.recordsWeb, { url: `${siteUrl.replace(/\/$/, "")}/${lang}/account` }, lang)}` : "";
  let body = "";
  let shown = 0;
  for (const r of records) {
    const block = formatRecord(r, lang);
    if (header.length + body.length + block.length + link.length + 200 > 3800) break;
    body += `\n\n${block}`;
    shown++;
  }
  const more = shown < records.length ? `\n\n${fmt(t.bot.recordsMore, { n: shown, total: records.length }, lang)}` : "";
  return `${header}${body}${more}${link}\n\n⚠️ ${t.common.disclaimer}`;
}

/** Reply in the person's language, or in both when they haven't picked one yet (e.g. arriving from a login link). */
export function bilingual(pick: (t: T, lang: Locale) => string, lang: Locale, chosen: boolean): string {
  if (chosen) return pick(getRawDictionary(lang), lang);
  return `${pick(getRawDictionary("km"), "km")}\n\n— — —\n\n${pick(getRawDictionary("en"), "en")}`;
}
