/**
 * Fixed, non-AI explanation text built from km.json / en.json.
 * Used when the AI is unavailable, slow, or produced unsafe text. The app must work without AI.
 */
import { fmt, getRawDictionary, type Locale } from "../../i18n";
import type { ExplainInput } from "../../domain/schemas";
import type { NextStep } from "../../domain/risk";

type RiskSummary = NonNullable<ExplainInput["risk"]>;
type LabSummary = NonNullable<ExplainInput["lab"]>;

export function chooseNextStepFromSummary(r: RiskSummary): NextStep {
  const f = r.findrisc;
  if (f.band === "high" || f.band === "very_high" || (r.cvd.available && (r.cvd.band === "20-30" || r.cvd.band === ">=30")))
    return "see_doctor_soon";
  if (f.recommendGlucoseTest) return "glucose_test";
  if (!r.cvd.available && r.cvd.reason === "bp_unknown") return "check_bp";
  return "healthy_habits";
}

export function labNextStep(lab: LabSummary): "lab_follow_up" | "lab_all_normal" {
  return lab.some((l) => l.flag === "outside_range") ? "lab_follow_up" : "lab_all_normal";
}

export function templateExplanation(input: ExplainInput): string {
  const lang = input.lang as Locale;
  const t = getRawDictionary(lang);
  const sep = lang === "km" ? " " : " ";
  const list = (items: string[]) =>
    items.length <= 1
      ? items.join("")
      : lang === "km"
        ? `${items.slice(0, -1).join(" ")} និង ${items[items.length - 1]}`
        : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

  if (input.kind === "risk" && input.risk) {
    const r = input.risk;
    const lines: string[] = [];
    lines.push(fmt(t.results.templates.diabetesLine, { band: t.results.findriscBands[r.findrisc.band] }, lang));
    const top = r.findrisc.factors.slice(0, 3).map((f) => t.results.factors[f.factor as keyof typeof t.results.factors] ?? f.factor);
    lines.push(top.length ? fmt(t.results.templates.factorsLine, { factors: list(top) }, lang) : t.results.templates.noFactorsLine);
    lines.push(
      r.cvd.available
        ? fmt(t.results.templates.heartLine, { band: t.results.cvdBands[r.cvd.band] }, lang)
        : t.results.templates.heartUnknownLine,
    );
    lines.push(t.results.nextSteps[chooseNextStepFromSummary(r)]);
    return lines.join(sep);
  }

  const lab = input.lab ?? [];
  const lines: string[] = [];
  const outside = lab.filter((l) => l.flag === "outside_range");
  const unread = lab.filter((l) => l.flag === "could_not_read");
  lines.push(outside.length ? fmt(t.lab.templates.outsideLine, { tests: list(outside.map((l) => l.test)) }, lang) : t.lab.templates.allNormalLine);
  if (unread.length) lines.push(fmt(t.lab.templates.unreadLine, { tests: list(unread.map((l) => l.test)) }, lang));
  lines.push(t.lab.nextSteps[labNextStep(lab)]);
  return lines.join(sep);
}
