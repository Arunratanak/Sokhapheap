import "server-only";
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI, type Part } from "@google/genai";

/**
 * Thin Gemini wrapper. Model names come from env (AI_MODEL, AI_MODEL_FAST) so they can be changed
 * without code changes. Each call tries the primary model, then the fast model, then gives up —
 * callers must always have a non-AI fallback.
 */

let client: GoogleGenAI | null = null;

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.AI_MODEL);
}

function getClient(): GoogleGenAI {
  client ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
    httpOptions: { timeout: 25_000, retryOptions: { attempts: 2, initialDelay: 0.5, maxDelay: 2 } },
  });
  return client;
}

const promptCache = new Map<string, string>();
export function loadPrompt(name: string): string {
  if (!promptCache.has(name)) {
    promptCache.set(name, fs.readFileSync(path.join(process.cwd(), "prompts", `${name}.md`), "utf8"));
  }
  return promptCache.get(name)!;
}

export interface GenerateOptions {
  system: string;
  parts: Part[];
  json?: boolean;
  /** Prefer the fast model first (e.g. short explanations). */
  preferFast?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  /** Reject a model's output (e.g. wrong script) and try the next model instead. */
  validate?: (text: string) => boolean;
}

/**
 * True if text uses only Khmer, Latin/ASCII, digits, common punctuation and emoji —
 * i.e. no stray Thai, Lao, Thaana or other scripts mixed into Khmer output.
 */
export function isCleanKhmerOrLatin(text: string): boolean {
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c <= 0x024f) continue; // ASCII + Latin-1 + Latin Extended
    if (c >= 0x1780 && c <= 0x17ff) continue; // Khmer
    if (c >= 0x19e0 && c <= 0x19ff) continue; // Khmer symbols
    if (c >= 0x2000 && c <= 0x206f) continue; // general punctuation, ZWSP
    if (c >= 0x20a0 && c <= 0x20cf) continue; // currency (៛ is in Khmer block)
    if (c >= 0x2100 && c <= 0x2bff) continue; // letterlike, arrows, math, symbols
    if (c >= 0x1f000) continue; // emoji
    if (c === 0x00b5 || c === 0x03bc) continue; // µ
    return false;
  }
  return true;
}

export async function generate(opts: GenerateOptions): Promise<{ text: string; model: string }> {
  if (!aiConfigured()) throw new Error("AI not configured");
  const primary = process.env.AI_MODEL!;
  const fast = process.env.AI_MODEL_FAST || primary;
  const models = [...new Set(opts.preferFast ? [fast, primary] : [primary, fast])];

  let lastError: unknown;
  for (const model of models) {
    try {
      const res = await getClient().models.generateContent({
        model,
        contents: [{ role: "user", parts: opts.parts }],
        config: {
          systemInstruction: opts.system,
          temperature: opts.temperature ?? 0.2,
          maxOutputTokens: opts.maxOutputTokens ?? 2048,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      });
      const text = res.text?.trim();
      if (text && (!opts.validate || opts.validate(text))) return { text, model };
      lastError = new Error(text ? "output failed validation" : "empty response");
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI call failed");
}
