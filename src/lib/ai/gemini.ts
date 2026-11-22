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
      if (text) return { text, model };
      lastError = new Error("empty response");
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI call failed");
}
