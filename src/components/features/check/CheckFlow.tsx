"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { fmtClient, parseNumberInput, toKhmerDigits } from "@/lib/client/util";
import { asksPregnancy, profileSchema, type Profile } from "@/domain/modules/profile";
import { MODULES, chooseModules, runModules, type CardResult } from "@/domain/modules/registry";
import { questionsToAsk, type Answers, type ModuleDefinition, type Urgency } from "@/domain/modules/types";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { InfoTip } from "@/components/ui/InfoTip";
import { waistInchesToCm } from "@/domain/units";
import { ArrowRight, CircleCheck, Info } from "lucide-react";
import { IconHealthCheck } from "@/components/ui/BrandIcons";
import { SaveRecordButton } from "@/components/features/account/SaveRecordButton";
import { healthCheckRecord } from "@/domain/records";

type Phase = "intro" | "profile" | "choose" | "questions" | "dashboard";
/** Opt-in screenings that need a lab report: pre-ticked when the person says they have one. */
const LAB_REPORT_MODULES = ["who_cvd_lab", "egfr"];
type Draft = Record<string, string | boolean | null>;

/** Read a dictionary value by dotted path (module questions reference existing i18n keys). */
function tr(t: Dictionary, key: string): string {
  const v = key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), t);
  return typeof v === "string" ? v : key;
}

const URGENCY_STYLE: Record<Urgency, { bg: string; fg: string; icon: string }> = {
  red_flag: { bg: "var(--danger-solid)", fg: "#ffffff", icon: "🚨" },
  high: { bg: "var(--danger-bg)", fg: "var(--danger-fg)", icon: "🔴" },
  moderate: { bg: "var(--caution-bg)", fg: "var(--caution-fg)", icon: "🟠" },
  low: { bg: "var(--ok-bg)", fg: "var(--ok-fg)", icon: "🟢" },
  incomplete: { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)", icon: "⚪" },
};

export function CheckFlow({ lang, t, allowed, preview, hasDrafts = false }: { lang: Locale; t: Dictionary; allowed: string[]; preview: boolean; hasDrafts?: boolean }) {
  const c = t.check;
  const modules = useMemo(() => MODULES.filter((m) => allowed.includes(m.id)), [allowed]);
  const [phase, setPhase] = useState<Phase>("intro");
  /** Index of the current screening question (one question per screen). */
  const [qStep, setQStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({ waistUnknown: false, bpUnknown: false });
  const [errors, setErrors] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answers>>({});
  /** Raw text typed into module number questions, keyed "moduleId.questionId". */
  const [numText, setNumText] = useState<Record<string, string>>({});
  const [cards, setCards] = useState<CardResult[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Each new screening question gets keyboard / screen-reader focus on its heading.
  useEffect(() => {
    if (phase === "questions") headingRef.current?.focus();
  }, [qStep, phase]);
  const go = (p: Phase) => {
    setPhase(p);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => headingRef.current?.focus());
  };
  const set = (k: string, v: string | boolean | null) => setDraft((d) => ({ ...d, [k]: v }));
  const n = (k: string) => parseNumberInput(String(draft[k] ?? ""));

  function submitProfile() {
    const smoker = draft.smokingStatus as Profile["smokingStatus"] | undefined;
    const candidate = {
      age: n("age"), sex: draft.sex, heightCm: n("heightCm"), weightKg: n("weightKg"),
      // Waist is typed in inches (trouser size) and converted to cm for scoring.
      waistCm: draft.waistUnknown ? null : (() => { const w = n("waistCm"); return w === null ? null : waistInchesToCm(w); })(),
      smokingStatus: smoker,
      // Not asked: no screening uses them (pack-years). The profile keeps the fields for future modules.
      cigarettesPerDay: null,
      smokingYears: null,
      // The bottom number is only asked once a top number is entered (adaptive).
      sbp: draft.bpUnknown ? null : n("sbp"), dbp: draft.bpUnknown || n("sbp") === null ? null : n("dbp"),
      // Yes/No question that must be answered (an unticked box used to mean "no" silently).
      bpMedication: draft.bpMedication === "yes" ? true : draft.bpMedication === "no" ? false : undefined,
      knownDiabetes: draft.knownDiabetes === true, knownHighBp: draft.knownHighBp === true,
      knownHeartDisease: draft.knownHeartDisease === true, knownKidneyDisease: draft.knownKidneyDisease === true,
      familyDiabetes: draft.familyDiabetes ?? undefined,
      pregnant: draft.pregnant === "yes" ? true : draft.pregnant === "no" ? false : null,
      province: null, district: null,
    };
    if (candidate.age !== null && candidate.sex && !asksPregnancy({ sex: candidate.sex as Profile["sex"], age: candidate.age })) candidate.pregnant = null;
    const parsed = profileSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors([...new Set(parsed.error.issues.map((i) => String(i.path[0])))]);
      return;
    }
    setErrors([]);
    setProfile(parsed.data);
    const choices = chooseModules(parsed.data, modules);
    // Adaptive: with a lab report at hand, also pre-tick the screenings that use cholesterol / creatinine.
    const withLab = draft.labReport === "yes" ? choices.filter((x) => x.eligible && LAB_REPORT_MODULES.includes(x.module.id)) : [];
    setSelected([...new Set([...choices.filter((x) => x.preselected), ...withLab].map((x) => x.module.id))]);
    go("choose");
  }

  function afterChoose() {
    const needQuestions = modules.some((m) => selected.includes(m.id) && questionsToAsk(m.questions, answers[m.id] ?? {}, profile!).length);
    setQStep(0);
    if (needQuestions) go("questions");
    else finish(answers);
  }

  function finish(a: Record<string, Answers>) {
    setCards(runModules(profile!, selected, a, modules));
    go("dashboard");
  }

  if (phase === "intro") return <WelcomeScreen t={t} headingRef={headingRef} onStart={() => go("profile")} />;

  // Preview (localhost) keeps its own note; on the public site, draft screenings always carry the "not yet reviewed" banner.
  const bannerText = preview ? `🧪 ${c.previewBanner}` : hasDrafts ? `⚠️ ${c.draftBanner}` : null;
  const banner = bannerText ? (
    <p role="note" className="rounded-lg border-2 border-dashed border-warn-border bg-warn-soft px-3 py-2 text-sm font-medium">{bannerText}</p>
  ) : null;

  // ---------------------------------------------------------------- 1. profile
  if (phase === "profile") {
    const err = (k: string) => errors.includes(k);
    const num = (k: string, label: string, unit?: string, opts?: { disabled?: boolean; help?: string }) => (
      <label className="flex flex-col gap-1 font-medium">
        {label}
        {opts?.help && <span className="text-sm font-normal text-muted">{opts.help}</span>}
        <span className="flex items-center gap-2">
          <input
            inputMode="decimal"
            className={`field w-32 ${err(k) ? "border-[var(--danger)]" : ""}`}
            value={String(draft[k] ?? "")}
            disabled={opts?.disabled}
            aria-invalid={err(k)}
            onChange={(e) => set(k, e.target.value)}
          />
          {unit && <span className="text-sm text-muted">{unit}</span>}
        </span>
      </label>
    );
    const choice = (k: string, legend: string, options: [string, string][]) => (
      <fieldset className="flex flex-col gap-2">
        <legend className={`mb-1 font-medium ${err(k) ? "text-[var(--danger)]" : ""}`}>{legend}</legend>
        {options.map(([v, label]) => (
          <label key={v} className={`flex min-h-12 items-center gap-3 rounded-xl border-2 px-3 ${draft[k] === v ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}>
            <input type="radio" name={k} checked={draft[k] === v} onChange={() => set(k, v)} />
            {label}
          </label>
        ))}
      </fieldset>
    );
    const check = (k: string, label: string) => (
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="h-5 w-5" checked={draft[k] === true} onChange={(e) => set(k, e.target.checked)} />
        {label}
      </label>
    );
    const age = n("age");
    const showPregnancy = draft.sex === "female" && age !== null && asksPregnancy({ sex: "female", age });
    return (
      <div className="flex flex-col gap-5 pt-2">
        {banner}
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">{c.profileTitle}</h1>
          <p className="text-sm text-muted">{c.profileIntro}</p>
        </div>
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{c.profileSection.body}</h2>
          {choice("sex", t.risk.sex.q, [["male", t.risk.sex.male], ["female", t.risk.sex.female]])}
          {num("age", t.risk.age.q, t.risk.age.unit)}
          {num("heightCm", t.risk.height.q, t.risk.height.unit)}
          {num("weightKg", t.risk.weight.q, t.risk.weight.unit)}
          {num("waistCm", t.risk.waist.q, t.risk.waist.unit, { disabled: draft.waistUnknown === true, help: t.risk.waist.help })}
          {check("waistUnknown", c.unknown)}
          {showPregnancy && choice("pregnant", c.pregnant.q, [["no", c.pregnant.no], ["yes", c.pregnant.yes], ["skip", c.pregnant.skip]])}
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{c.profileSection.smoking}</h2>
          {choice("smokingStatus", c.smokingStatus.q, [["never", c.smokingStatus.never], ["former", c.smokingStatus.former], ["current", c.smokingStatus.current]])}
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{c.profileSection.bp}</h2>
          {num("sbp", c.sbp, "mmHg", { disabled: draft.bpUnknown === true })}
          {!draft.bpUnknown && n("sbp") !== null && num("dbp", c.dbp, "mmHg")}
          {check("bpUnknown", c.bpUnknown)}
          {choice("bpMedication", t.risk.bpMeds.q, [["yes", t.common.yes], ["no", t.common.no]])}
          <InfoTip label={t.common.whatIsThis}>{t.risk.bpMeds.info}</InfoTip>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">{c.profileSection.conditions}</h2>
          <p className="text-sm">{c.conditionsQ}</p>
          {(["knownDiabetes", "knownHighBp", "knownHeartDisease", "knownKidneyDisease"] as const).map((k) => <div key={k}>{check(k, c.conditions[k])}</div>)}
        </section>
        <section className="flex flex-col gap-2">
          {choice("labReport", c.labReport.q, [["yes", c.labReport.yes], ["no", c.labReport.no]])}
          <p className="text-sm text-muted">{c.labReport.help}</p>
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{c.profileSection.family}</h2>
          {choice("familyDiabetes", t.risk.family.q, [["none", t.risk.family.none], ["second_degree", t.risk.family.second], ["first_degree", t.risk.family.first]])}
        </section>
        {errors.length > 0 && <p role="alert" className="font-medium text-[var(--danger)]">{c.fixErrors}</p>}
        <button className="btn-primary" onClick={submitProfile}>{c.continue}</button>
      </div>
    );
  }

  // ---------------------------------------------------------------- 2. choose
  if (phase === "choose" && profile) {
    const choices = chooseModules(profile, modules);
    const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const row = (m: ModuleDefinition) => (
      <label key={m.id} className={`flex items-start gap-3 rounded-xl border-2 p-3 ${selected.includes(m.id) ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}>
        <input type="checkbox" className="mt-1 h-5 w-5" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
        <span>
          <span className="block font-semibold">{m.title[lang]}{m.status === "draft" && <span className="ml-2 rounded bg-warn-soft px-1.5 text-xs">{c.draftTag}</span>}</span>
          <span className="block text-sm text-muted">{c.areas[m.healthArea]} · {m.summary[lang]}</span>
        </span>
      </label>
    );
    const core = choices.filter((x) => x.eligible && x.module.sensitivity === "normal");
    const optional = choices.filter((x) => x.eligible && x.module.sensitivity === "sensitive");
    const notForYou = choices.filter((x) => !x.eligible);
    return (
      <div className="flex flex-col gap-5 pt-2">
        {banner}
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">{c.chooseTitle}</h1>
          <p className="text-sm text-muted">{c.chooseIntro}</p>
        </div>
        {core.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">{c.recommended}</h2>
            {core.map((x) => row(x.module))}
          </section>
        )}
        {optional.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">{c.optionalTitle}</h2>
            <p className="text-sm text-muted">🔒 {c.optionalIntro}</p>
            {optional.map((x) => row(x.module))}
          </section>
        )}
        {notForYou.length > 0 && (
          <section className="flex flex-col gap-1 text-sm text-muted">
            <h2 className="font-semibold">{c.notForYou}</h2>
            {notForYou.map((x) => (
              <p key={x.module.id}>• {x.module.title[lang]}: {c.reasons[x.reason as keyof typeof c.reasons] ?? ""}</p>
            ))}
          </section>
        )}
        {!selected.length && <p role="status" className="text-sm">{c.noneSelected}</p>}
        <button className="btn-primary" disabled={!selected.length} onClick={afterChoose}>{c.continue}</button>
      </div>
    );
  }

  // ---------------------------------------------------------------- 3. module questions (one per screen, adaptive)
  if (phase === "questions" && profile) {
    // The flow is rebuilt from the answers so far: a follow-up (showIf) appears right after the answer that triggers it.
    const flow = modules
      .filter((m) => selected.includes(m.id))
      .flatMap((m) => questionsToAsk(m.questions, answers[m.id] ?? {}, profile).map((q) => ({ m, q })));
    if (!flow.length) return null;
    const i = Math.min(qStep, flow.length - 1);
    const { m, q } = flow[i];
    const v = answers[m.id]?.[q.id];
    const answered = v !== undefined;
    const isLast = i === flow.length - 1;
    const setA = (mid: string, qid: string, val: Answers[string] | undefined) =>
      setAnswers((a) => {
        const next = { ...a[mid] };
        if (val === undefined) delete next[qid];
        else next[qid] = val;
        return { ...a, [mid]: next };
      });
    const toStep = (k: number) => {
      setQStep(k);
      window.scrollTo(0, 0); // focus moves to the new question in the effect above
    };
    // Tap answers move on by themselves (like the risk check); the next question is chosen from the new answers.
    const pick = (val: Answers[string]) => {
      setA(m.id, q.id, val);
      window.setTimeout(() => toStep(i + 1), 180);
    };
    const option = (key: string, label: string, selectedNow: boolean, onPick: () => void) => (
      <label key={key} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 text-lg transition-colors ${selectedNow ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand"}`}>
        <input type="radio" name={`${m.id}.${q.id}`} checked={selectedNow} onChange={onPick} />
        {label}
      </label>
    );
    const key = `${m.id}.${q.id}`;
    const unknown = v === null;
    const onText = (text: string) => {
      if (q.kind !== "number") return;
      setNumText((st) => ({ ...st, [key]: text }));
      const x = parseNumberInput(text);
      const ok = x !== null && x >= q.min && x <= q.max && (!q.integer || Number.isInteger(x));
      setA(m.id, q.id, ok ? x : undefined); // not answered until the number is valid
    };
    return (
      <div className="flex flex-col gap-5 pt-2">
        {banner}
        <div>
          <p className="mb-1 text-sm text-muted">{fmtClient(t.common.stepOf, { n: i + 1, total: flow.length }, lang)}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10" role="progressbar" aria-valuemin={1} aria-valuemax={flow.length} aria-valuenow={i + 1} aria-label={c.questionsTitle}>
            <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `${((i + 1) / flow.length) * 100}%` }} />
          </div>
        </div>
        <div key={key} className="rise-in flex flex-col gap-4">
          <p className="eyebrow">{m.title[lang]}</p>
          <h1 ref={headingRef} tabIndex={-1} id={`q-${key}`} className="text-2xl leading-snug font-bold outline-none">{tr(t, q.textKey)}</h1>
          {q.helpKey && <p className="text-muted">{tr(t, q.helpKey)}</p>}
          {q.kind === "yesno" && (
            <div role="radiogroup" aria-labelledby={`q-${key}`} className="flex flex-col gap-3">
              {option("yes", t.common.yes, v === true, () => pick(true))}
              {option("no", t.common.no, v === false, () => pick(false))}
            </div>
          )}
          {q.kind === "choice" && (
            <div role="radiogroup" aria-labelledby={`q-${key}`} className="flex flex-col gap-3">
              {q.options.map((o) => option(o.value, tr(t, o.labelKey), v === o.value, () => pick(o.value)))}
            </div>
          )}
          {q.kind === "number" && (
            <div className="flex flex-col gap-3">
              <span className="flex items-center gap-3">
                <input
                  aria-labelledby={`q-${key}`}
                  inputMode="decimal"
                  autoComplete="off"
                  className="min-h-14 w-40 rounded-xl border-2 border-line bg-surface px-4 text-2xl font-semibold"
                  value={unknown ? "" : (numText[key] ?? "")}
                  disabled={unknown}
                  onChange={(e) => onText(e.target.value)}
                />
                {q.unitKey && <span className="text-lg text-muted">{tr(t, q.unitKey)}</span>}
              </span>
              {q.allowUnknown && (
                <label className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" className="h-5 w-5" checked={unknown} onChange={(e) => (e.target.checked ? setA(m.id, q.id, null) : onText(numText[key] ?? ""))} />
                  {c.unknown}
                </label>
              )}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <button className="btn-ghost" onClick={() => (i === 0 ? go("choose") : toStep(i - 1))}>← {t.common.back}</button>
          {isLast ? (
            <button className="btn-primary" disabled={!answered} onClick={() => finish(answers)}>{c.seeResults}</button>
          ) : (
            <button className="btn-primary" disabled={!answered} onClick={() => toStep(i + 1)}>{t.common.next} →</button>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- 4. dashboard
  const byId = new Map(modules.map((m) => [m.id, m]));
  const digits = (v: number) => (lang === "km" ? toKhmerDigits(v) : String(v));
  return (
    <div className="flex flex-col gap-5 pt-2">
      {banner}
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">{c.dashboardTitle}</h1>
        <p className="text-sm text-muted">{c.dashboardIntro}</p>
      </div>
      <ul className="flex flex-col gap-4">
        {cards.map((card) => {
          const m = byId.get(card.moduleId)!;
          const urgency: Urgency = card.redFlag ? "red_flag" : card.result!.urgency;
          const s = URGENCY_STYLE[urgency];
          const r = card.result;
          return (
            <li key={card.moduleId} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{c.areas[m.healthArea]}</p>
              <h2 className="text-lg font-bold">{m.title[lang]}</h2>
              <p className="mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-semibold" style={{ background: s.bg, color: s.fg }}>
                <span aria-hidden>{s.icon}</span>
                {/* The tool's own band words; urgency words only where there is no band (urgent / not checked). */}
                {r && r.band !== "unavailable" ? m.bands[r.band]?.[lang] : c.urgency[urgency]}
              </p>
              {card.redFlag && <p className="mt-2 font-semibold text-[var(--danger)]">{c.urgentCard}</p>}
              {r && r.band === "unavailable" && <p className="mt-2">{(m.bands[`unavailable:${String(r.details?.reason)}`] ?? m.bands.unavailable)?.[lang]}</p>}
              {r && r.score !== null && (
                <p className="mt-1 text-sm text-muted">
                  {c.score}: {digits(r.score)}{m.scoreUnit?.[lang] ?? ""}
                  {m.id === "findrisc" && <> · {fmtClient(t.results.bmiLabel, { bmi: Number(r.details?.bmi) }, lang)}</>}
                </p>
              )}
              {r && r.factors.length > 0 && (
                <p className="mt-1 text-sm">
                  <span className="font-medium">{c.topFactors}:</span>{" "}
                  {r.factors.slice(0, 3).map((f) => tr(t, `results.factors.${f.factor}`)).join(", ")}
                </p>
              )}
              {r && (
                <div className="mt-3 rounded-xl bg-brand-soft p-3">
                  <p className="text-sm font-semibold text-brand-strong">👉 {c.nextStep}</p>
                  <p>{tr(t, r.nextStepKey)}</p>
                </div>
              )}
              <Link
                href={`/${lang}/map?type=${r?.facilityType === "referral_hospital" ? "hospital" : "health_centre"}`}
                className="btn-ghost mt-2 justify-start px-0 text-sm"
              >
                📍 {c.findCare} →
              </Link>
            </li>
          );
        })}
      </ul>
      {cards.length > 0 && <SaveRecordButton lang={lang} t={t} record={healthCheckRecord(cards)} />}
      <Disclaimer text={t.common.disclaimer} />
      <button className="btn-ghost" onClick={() => { setCards([]); setAnswers({}); setNumText({}); setQStep(0); go("profile"); }}>↺ {c.startOver}</button>
    </div>
  );
}

/** Warm welcome before the health check: what it does, a gentle note, and a Start button (CSS entrance animation). */
function WelcomeScreen({ t, headingRef, onStart }: { t: Dictionary; headingRef: React.RefObject<HTMLHeadingElement | null>; onStart: () => void }) {
  const w = t.check.welcome;
  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="rise-in card relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden className="absolute -top-20 -right-16 h-56 w-56 rounded-full opacity-25 blur-3xl [background:var(--gradient)]" />
        <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-surface-2 text-brand-strong ring-1 ring-line">
          <IconHealthCheck size={40} />
        </span>
        <p className="eyebrow relative mt-5">{w.eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1} className="relative mt-2 text-3xl leading-tight font-bold tracking-tight text-balance outline-none">
          {w.title}
        </h1>
        <p className="relative mt-3 text-lg text-muted">{w.body}</p>
        <ul className="relative mt-5 flex flex-col gap-3">
          {w.points.map((p, i) => (
            <li key={p} className="rise-in flex items-start gap-3" style={{ animationDelay: `${180 + i * 120}ms` }}>
              <CircleCheck aria-hidden size={22} className="mt-0.5 shrink-0 text-accent" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="rise-in flex items-start gap-3 rounded-xl border border-warn-border bg-warn-soft px-4 py-3 text-sm" style={{ animationDelay: "560ms" }}>
        <Info aria-hidden size={18} className="mt-0.5 shrink-0" />
        <span>{w.note}</span>
      </p>
      <button className="rise-in btn-primary group w-full sm:w-auto sm:self-start sm:px-10" style={{ animationDelay: "680ms" }} onClick={onStart}>
        {w.start}
        <ArrowRight aria-hidden size={20} className="transition-transform duration-200 group-hover:translate-x-1" />
      </button>
    </div>
  );
}
