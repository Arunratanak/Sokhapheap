const KHMER_DIGITS = "០១២៣៤៥៦៧៨៩";

/** 1440 → "1,440" (English) or "១,៤៤០" (Khmer). Safe on server and client (no "use client" imports). */
export function formatCount(n: number, lang: "en" | "km", decimals = 0): string {
  const s = n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return lang === "km" ? s.replace(/\d/g, (d) => KHMER_DIGITS[Number(d)]) : s;
}
