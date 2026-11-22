import "server-only";
import { aiConfigured, generate, loadPrompt } from "./gemini";
import { extractedLabArraySchema } from "../schemas";
import type { ExtractedLabValue } from "../scoring/labRanges";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export class ExtractionUnavailableError extends Error {}

/** Parse the model's JSON, tolerating code fences or a wrapping object. */
export function parseExtraction(text: string): ExtractedLabValue[] | null {
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  let raw: unknown;
  try {
    raw = JSON.parse(stripped);
  } catch {
    const m = stripped.match(/\[[\s\S]*\]/);
    if (!m) return null;
    try {
      raw = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    const firstArray = Object.values(raw).find(Array.isArray);
    if (firstArray) raw = firstArray;
  }
  // Coerce numeric strings like "5,6" → 5.6 before validation.
  if (Array.isArray(raw)) {
    raw = raw.map((r) => {
      if (!r || typeof r !== "object") return r;
      const o = { ...(r as Record<string, unknown>) };
      for (const k of ["value", "printed_range_low", "printed_range_high", "confidence"]) {
        if (typeof o[k] === "string") {
          const n = Number(String(o[k]).replace(",", ".").replace(/[^\d.\-]/g, ""));
          o[k] = String(o[k]).trim() === "" || Number.isNaN(n) ? null : n;
        }
        if (o[k] === undefined) o[k] = k === "confidence" ? 0 : null;
      }
      if (o.unit === undefined) o.unit = null;
      if (o.confidence === null) o.confidence = 0;
      return o;
    });
  }
  const parsed = extractedLabArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Sends the image (in memory only) to the AI and returns extracted values.
 * The image buffer is never written to disk or storage; the caller drops its reference afterwards.
 */
export async function extractLabValues(image: Buffer, mimeType: string): Promise<ExtractedLabValue[]> {
  if (!aiConfigured()) throw new ExtractionUnavailableError("AI not configured");
  let text: string;
  try {
    ({ text } = await generate({
      system: loadPrompt("extract_lab"),
      parts: [
        { inlineData: { mimeType, data: image.toString("base64") } },
        { text: "Extract the lab results from this report as the JSON array described." },
      ],
      json: true,
      temperature: 0,
      maxOutputTokens: 4096,
    }));
  } catch (e) {
    throw new ExtractionUnavailableError((e as Error).message);
  }
  const values = parseExtraction(text);
  if (!values) throw new ExtractionUnavailableError("AI returned invalid JSON");
  return values;
}
