import km from "./km.json";
import en from "./en.json";

export const locales = ["km", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "km";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export type Dictionary = typeof km;

const ZWSP = "​";
const KHMER = /[ក-៿]/;

/**
 * Khmer is written without spaces between words, so browsers can't wrap long
 * lines and the page overflows on phones. Insert zero-width spaces at word
 * boundaries (ICU dictionary segmentation) so lines wrap between words.
 */
export function addKhmerLineBreaks(text: string): string {
  if (!KHMER.test(text)) return text;
  const segmenter = new Intl.Segmenter("km", { granularity: "word" });
  const parts = [...segmenter.segment(text.replaceAll(ZWSP, ""))].map((s) => s.segment);
  return parts.reduce((out, part, i) => {
    const prev = parts[i - 1];
    const needsBreak = i > 0 && KHMER.test(part[0]) && KHMER.test(prev[prev.length - 1]);
    return out + (needsBreak ? ZWSP : "") + part;
  }, "");
}

function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]),
    ) as T;
  }
  return value;
}

const dictionaries: Record<Locale, Dictionary> = {
  km: mapStrings(km, addKhmerLineBreaks),
  en,
};

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Dictionary for rendering on the web (Khmer strings include line-break hints). */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Replace {name} placeholders. Numbers are shown in Khmer digits for Khmer text. */
export function fmt(template: string, vars: Record<string, string | number>, locale: Locale = "en"): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    if (v === undefined) return `{${k}}`;
    return typeof v === "number" ? formatNumber(v, locale) : v;
  });
}

const KHMER_DIGITS = "០១២៣៤៥៦៧៨៩";
export function formatNumber(n: number, locale: Locale, maxFractionDigits = 1): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(maxFractionDigits).replace(/\.0+$/, "");
  return locale === "km" ? s.replace(/\d/g, (d) => KHMER_DIGITS[Number(d)]) : s;
}

/** Raw strings, without line-break hints (for the Telegram bot and plain text). */
export function getRawDictionary(locale: Locale): Dictionary {
  return locale === "km" ? km : en;
}
