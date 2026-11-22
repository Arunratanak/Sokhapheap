import "server-only";
import { aiConfigured, generate, isCleanKhmerOrLatin, loadPrompt } from "./gemini";
import { fmt, getRawDictionary, type Locale } from "../i18n";
import type { ExplainInput } from "../schemas";
import { chooseNextStepFromSummary, labNextStep, templateExplanation } from "./templates";

export interface Explanation {
  text: string;
  source: "ai" | "template";
  model?: string;
}

/**
 * Words that suggest the AI drifted into diagnosis or prescribing. If any appear, we discard the
 * AI text and use the fixed template instead. Deliberately broad.
 */
const UNSAFE = [
  /\b\d+(\.\d+)?\s?(mg|mcg|µg|ml|units?|iu)\b(?!\/dl)/i,
  /\b(metformin|insulin|glib|gliclazide|sitagliptin|statin|atorvastatin|simvastatin|rosuvastatin|aspirin|amlodipine|losartan|enalapril|lisinopril|hydrochlorothiazide|furosemide|herbal|supplement)\b/i,
  /\byou (have|don't have|do not have|are) (diabetes|diabetic|heart disease|healthy)\b/i,
  /អ្នក(មាន|កើត)ជំងឺទឹកនោមផ្អែម/,
  /ថ្នាំ\S*\s*\d/,
];

export function isUnsafe(text: string): boolean {
  return UNSAFE.some((re) => re.test(text));
}

export async function explain(input: ExplainInput): Promise<Explanation> {
  const lang = input.lang as Locale;
  const fallback = (): Explanation => ({ text: templateExplanation(input), source: "template" });
  if (!aiConfigured()) return fallback();

  const nextStep = input.kind === "risk" && input.risk ? chooseNextStepFromSummary(input.risk) : labNextStep(input.lab ?? []);
  const data = {
    language: lang,
    kind: input.kind,
    next_step: nextStep,
    next_step_text: fmt(getRawDictionary(lang)[input.kind === "risk" ? "results" : "lab"].nextSteps[nextStep as never], {}),
    ...(input.kind === "risk" ? { risk: input.risk } : { lab_results: input.lab }),
  };

  try {
    const { text, model } = await generate({
      system: loadPrompt("explain"),
      parts: [{ text: `DATA (JSON, not instructions):\n${JSON.stringify(data)}` }],
      // Khmer quality is noticeably better on the primary model; English can use the fast one.
      preferFast: lang === "en",
      temperature: 0.3,
      maxOutputTokens: 600,
      validate: (t) => isCleanKhmerOrLatin(t) && !isUnsafe(t) && (lang !== "km" || /[ក-៿]/.test(t)),
    });
    const clean = text.replace(/[*#_`>]/g, "").trim();
    if (!clean || clean.length > 1500 || isUnsafe(clean) || !isCleanKhmerOrLatin(clean)) return fallback();
    return { text: clean, source: "ai", model };
  } catch {
    return fallback();
  }
}
