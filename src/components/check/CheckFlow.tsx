"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { fmtClient, parseNumberInput, toKhmerDigits } from "@/lib/client/util";
import { asksPregnancy, profileSchema, type Profile } from "@/lib/modules/profile";
import { MODULES, chooseModules, runModules, type CardResult } from "@/lib/modules/registry";
import type { Answers, ModuleDefinition, ModuleQuestion, Urgency } from "@/lib/modules/types";
import { Disclaimer } from "@/components/Disclaimer";
import { GoNowScreen, UrgentScreen } from "@/components/risk/RiskFlow";

type Phase = "urgent" | "goNow" | "profile" | "choose" | "questions" | "dashboard";
type Draft = Record<string, string | boolean | null>;

/** Read a dictionary value by dotted path (module questions reference existing i18n keys). */
function tr(t: Dictionary, key: string): string {
  const v = key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), t);
  return typeof v === "string" ? v : key;
}

const URGENCY_STYLE: Record<Urgency, { bg: string; fg: string; icon: string }> = {
  red_flag: { bg: "#b42318", fg: "#ffffff", icon: "🚨" },
  high: { bg: "#fde2df", fg: "#7a1610", icon: "🔴" },
  moderate: { bg: "#fff1d6", fg: "#6b4500", icon: "🟠" },
  low: { bg: "#e3f2ea", fg: "#14532d", icon: "🟢" },
  incomplete: { bg: "#eef2f6", fg: "#1f2937", icon: "⚪" },
};

export function CheckFlow({ lang, t, allowed, preview }: { lang: Locale; t: Dictionary; allowed: string[]; preview: boolean }) {
  const c = t.check;
  const modules = useMemo(() => MODULES.filter((m) => allowed.includes(m.id)), [allowed]);
  const [phase, setPhase] = useState<Phase>("urgent");
  const [draft, setDraft] = useState<Draft>({ waistUnknown: false, bpUnknown: false });
  const [errors, setErrors] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answers>>({});
  /** Raw text typed into module number questions, keyed "moduleId.questionId". */
  const [numText, setNumText] = useState<Record<string, string>>({});
  const [cards, setCards] = useState<CardResult[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
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
      waistCm: draft.waistUnknown ? null : n("waistCm"),
      smokingStatus: smoker,
      cigarettesPerDay: smoker && smoker !== "never" ? n("cigarettesPerDay") : null,
      smokingYears: smoker && smoker !== "never" ? n("smokingYears") : null,
      sbp: draft.bpUnknown ? null : n("sbp"), dbp: draft.bpUnknown ? null : n("dbp"),
      bpMedication: draft.bpMedication === true,
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
    setSelected(chooseModules(parsed.data, modules).filter((x) => x.preselected).map((x) => x.module.id));
    go("choose");
  }

  function afterChoose() {
    const needQuestions = modules.some((m) => selected.includes(m.id) && m.questions.length);
    if (needQuestions) go("questions");
    else finish(answers);
  }

  function finish(a: Record<string, Answers>) {
    setCards(runModules(profile!, selected, a, modules));
    go("dashboard");
  }

  if (phase === "urgent") return <UrgentScreen t={t} headingRef={headingRef} onUrgent={() => go("goNow")} onSafe={() => go("profile")} />;
  if (phase === "goNow") return <GoNowScreen lang={lang} t={t} headingRef={headingRef} onContinue={() => go("urgent")} />;

  const banner = preview ? <p className="rounded-lg border-2 border-dashed border-warn-border bg-warn-soft px-3 py-2 text-sm font-medium">🧪 {c.previewBanner}</p> : null;

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
            className={`field w-32 ${err(k) ? "border-[#b42318]" : ""}`}
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
        <legend className={`mb-1 font-medium ${err(k) ? "text-[#b42318]" : ""}`}>{legend}</legend>
        {options.map(([v, label]) => (
          <label key={v} className={`flex min-h-12 items-center gap-3 rounded-xl border-2 px-3 ${draft[k] === v ? "border-brand bg-brand-soft" : "border-black/15 bg-surface"}`}>
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
    const smoker = draft.smokingStatus;
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
          {smoker && smoker !== "never" && (
            <>
              {num("cigarettesPerDay", c.cigarettesPerDay)}
              {num("smokingYears", c.smokingYears)}
            </>
          )}
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{c.profileSection.bp}</h2>
          {num("sbp", c.sbp, "mmHg", { disabled: draft.bpUnknown === true })}
          {num("dbp", c.dbp, "mmHg", { disabled: draft.bpUnknown === true })}
          {check("bpUnknown", c.bpUnknown)}
          {check("bpMedication", t.risk.bpMeds.q)}
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">{c.profileSection.conditions}</h2>
          <p className="text-sm">{c.conditionsQ}</p>
          {(["knownDiabetes", "knownHighBp", "knownHeartDisease", "knownKidneyDisease"] as const).map((k) => <div key={k}>{check(k, c.conditions[k])}</div>)}
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{c.profileSection.family}</h2>
          {choice("familyDiabetes", t.risk.family.q, [["none", t.risk.family.none], ["second_degree", t.risk.family.second], ["first_degree", t.risk.family.first]])}
        </section>
        {errors.length > 0 && <p role="alert" className="font-medium text-[#b42318]">{c.fixErrors}</p>}
        <button className="btn-primary" onClick={submitProfile}>{c.continue}</button>
      </div>
    );
  }

  // ---------------------------------------------------------------- 2. choose
  if (phase === "choose" && profile) {
    const choices = chooseModules(profile, modules);
    const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const row = (m: ModuleDefinition) => (
      <label key={m.id} className={`flex items-start gap-3 rounded-xl border-2 p-3 ${selected.includes(m.id) ? "border-brand bg-brand-soft" : "border-black/15 bg-surface"}`}>
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

  // ---------------------------------------------------------------- 3. module questions
  if (phase === "questions" && profile) {
    const chosen = modules.filter((m) => selected.includes(m.id) && m.questions.length);
    const complete = chosen.every((m) => m.questions.every((q) => answers[m.id]?.[q.id] !== undefined));
    const setA = (mid: string, qid: string, v: Answers[string] | undefined) =>
      setAnswers((a) => {
        const next = { ...a[mid] };
        if (v === undefined) delete next[qid];
        else next[qid] = v;
        return { ...a, [mid]: next };
      });
    const question = (m: ModuleDefinition, q: ModuleQuestion) => {
      const v = answers[m.id]?.[q.id];
      const help = q.helpKey && <p className="text-sm text-muted">{tr(t, q.helpKey)}</p>;
      if (q.kind === "choice")
        return (
          <fieldset key={q.id} className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">{tr(t, q.textKey)}</legend>
            {help}
            {q.options.map((o) => (
              <label key={o.value} className={`flex min-h-12 items-center gap-3 rounded-xl border-2 px-3 ${v === o.value ? "border-brand bg-brand-soft" : "border-black/15 bg-surface"}`}>
                <input type="radio" name={`${m.id}.${q.id}`} checked={v === o.value} onChange={() => setA(m.id, q.id, o.value)} />
                {tr(t, o.labelKey)}
              </label>
            ))}
          </fieldset>
        );
      if (q.kind === "number") {
        const key = `${m.id}.${q.id}`;
        const unknown = v === null;
        const onText = (text: string) => {
          setNumText((s) => ({ ...s, [key]: text }));
          const x = parseNumberInput(text);
          const ok = x !== null && x >= q.min && x <= q.max && (!q.integer || Number.isInteger(x));
          setA(m.id, q.id, ok ? x : undefined); // incomplete until the number is valid
        };
        return (
          <div key={q.id} className="flex flex-col gap-1">
            <label className="flex flex-col gap-1 font-medium">
              {tr(t, q.textKey)}
              {help}
              <span className="flex items-center gap-2">
                <input inputMode="decimal" className="field w-32" value={unknown ? "" : (numText[key] ?? "")} disabled={unknown} onChange={(e) => onText(e.target.value)} />
                {q.unitKey && <span className="text-sm text-muted">{tr(t, q.unitKey)}</span>}
              </span>
            </label>
            {q.allowUnknown && (
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" className="h-5 w-5" checked={unknown} onChange={(e) => (e.target.checked ? setA(m.id, q.id, null) : onText(numText[key] ?? ""))} />
                {c.unknown}
              </label>
            )}
          </div>
        );
      }
      if (q.kind === "yesno")
        return (
          <fieldset key={q.id} className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">{tr(t, q.textKey)}</legend>
            {q.helpKey && <p className="text-sm text-muted">{tr(t, q.helpKey)}</p>}
            <div className="grid grid-cols-2 gap-2">
              {([[true, t.common.yes], [false, t.common.no]] as const).map(([val, label]) => (
                <label key={String(val)} className={`flex min-h-12 items-center gap-3 rounded-xl border-2 px-3 ${v === val ? "border-brand bg-brand-soft" : "border-black/15 bg-surface"}`}>
                  <input type="radio" name={`${m.id}.${q.id}`} checked={v === val} onChange={() => setA(m.id, q.id, val)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        );
      return null;
    };
    return (
      <div className="flex flex-col gap-5 pt-2">
        {banner}
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">{c.questionsTitle}</h1>
          <p className="text-sm text-muted">{c.questionsIntro}</p>
        </div>
        {chosen.map((m) => (
          <section key={m.id} className="flex flex-col gap-4">
            <h2 className="text-lg font-bold">{m.title[lang]}</h2>
            {m.questions.map((q) => question(m, q))}
          </section>
        ))}
        <button className="btn-primary" disabled={!complete} onClick={() => finish(answers)}>{c.seeResults}</button>
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
            <li key={card.moduleId} className="rounded-2xl border border-black/10 bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{c.areas[m.healthArea]}</p>
              <h2 className="text-lg font-bold">{m.title[lang]}</h2>
              <p className="mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-semibold" style={{ background: s.bg, color: s.fg }}>
                <span aria-hidden>{s.icon}</span>
                {/* The tool's own band words; urgency words only where there is no band (urgent / not checked). */}
                {r && r.band !== "unavailable" ? m.bands[r.band]?.[lang] : c.urgency[urgency]}
              </p>
              {card.redFlag && <p className="mt-2 font-semibold text-[#b42318]">{c.urgentCard}</p>}
              {r && r.band === "unavailable" && <p className="mt-2">{(m.bands[`unavailable:${String(r.details?.reason)}`] ?? m.bands.unavailable)?.[lang]}</p>}
              {r && r.score !== null && (
                <p className="mt-1 text-sm text-muted">
                  {c.score}: {digits(r.score)}{m.id === "who_cvd" || m.id === "who_cvd_lab" ? "%" : ""}
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
      <Disclaimer text={t.common.disclaimer} />
      <button className="btn-ghost" onClick={() => { setCards([]); setAnswers({}); setNumText({}); go("profile"); }}>↺ {c.startOver}</button>
    </div>
  );
}
