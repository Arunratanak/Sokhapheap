"use client";

const KHMER_DIGITS = "០១២៣៤៥៦៧៨៩";

/** Parse a number typed on a phone — accepts Khmer digits (០-៩) and a comma decimal separator. */
export function parseNumberInput(raw: string): number | null {
  const ascii = raw
    .trim()
    .replace(/[០-៩]/g, (d) => String(KHMER_DIGITS.indexOf(d)))
    .replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(ascii)) return null;
  const n = Number(ascii);
  return Number.isFinite(n) ? n : null;
}

export function toKhmerDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => KHMER_DIGITS[Number(d)]);
}

export function fmtClient(template: string, vars: Record<string, string | number>, lang: "km" | "en"): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    if (v === undefined) return `{${k}}`;
    if (typeof v === "number") {
      const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
      return lang === "km" ? toKhmerDigits(s) : s;
    }
    return v;
  });
}

export function getPosition(timeoutMs = 10_000): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300_000 },
    );
  });
}

/** Cambodia bounding box — locations outside it (e.g. testers abroad) fall back to area selection. */
export function inCambodia(lat: number, lng: number): boolean {
  return lat >= 9.5 && lat <= 15 && lng >= 102 && lng <= 108;
}

export function formatKm(meters: number, lang: "km" | "en"): string {
  const km = meters < 10_000 ? (meters / 1000).toFixed(1) : String(Math.round(meters / 1000));
  return lang === "km" ? toKhmerDigits(km) : km;
}
