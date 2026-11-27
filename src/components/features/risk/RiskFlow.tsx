"use client";

import { API_BASE, BASE_PATH } from "@/lib/client/api-base";
import { useEffect, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { fmtClient, getPosition, inCambodia, parseNumberInput } from "@/lib/client/util";
import { FacilityList, type FacilityItem } from "@/components/features/map/FacilityList";
import { ResultsView, type RiskApiResult } from "./ResultsView";
import { InfoTip } from "@/components/ui/InfoTip";
import { WAIST_INCHES, waistCmToInches, waistInchesToCm } from "@/domain/units";
import { LoadingState } from "@/components/ui/LoadingState";

type YesNo = boolean;
export interface Answers {
  sex?: "male" | "female";
  age?: number;
  heightCm?: number;
  weightKg?: number;
  waistCm?: number | null;
  physicallyActive?: YesNo;
  dailyVegFruit?: YesNo;
  bpMedication?: YesNo;
  highGlucoseHistory?: YesNo;
  familyHistory?: "none" | "second_degree" | "first_degree";
  smoker?: YesNo;
  sbp?: number | null;
  province?: string | null;
}

/** Demo person that produces a "high risk" result (see docs/DEMO_SCRIPT.md). */
export const DEMO_ANSWERS: Required<Answers> = {
  sex: "male", age: 58, heightCm: 165, weightKg: 78, waistCm: 98, physicallyActive: false, dailyVegFruit: false,
  bpMedication: true, highGlucoseHistory: false, familyHistory: "second_degree", smoker: true, sbp: 150, province: "Phnom Penh",
};

type Step =
  | { key: "sex"; kind: "choice" }
  | { key: "familyHistory"; kind: "choice" }
  | { key: "physicallyActive" | "dailyVegFruit" | "bpMedication" | "highGlucoseHistory" | "smoker"; kind: "yesno" }
  | { key: "age" | "heightCm" | "weightKg" | "waistCm" | "sbp"; kind: "number"; min: number; max: number; allowUnknown?: boolean; inches?: boolean }
  | { key: "province"; kind: "province" };

const STEPS: Step[] = [
  { key: "sex", kind: "choice" },
  { key: "age", kind: "number", min: 18, max: 120 },
  { key: "heightCm", kind: "number", min: 100, max: 230 },
  { key: "weightKg", kind: "number", min: 25, max: 300 },
  // Asked in inches (trouser size), stored in cm for scoring.
  { key: "waistCm", kind: "number", min: WAIST_INCHES.min, max: WAIST_INCHES.max, allowUnknown: true, inches: true },
  { key: "physicallyActive", kind: "yesno" },
  { key: "dailyVegFruit", kind: "yesno" },
  { key: "bpMedication", kind: "yesno" },
  { key: "highGlucoseHistory", kind: "yesno" },
  { key: "familyHistory", kind: "choice" },
  { key: "smoker", kind: "yesno" },
  { key: "sbp", kind: "number", min: 60, max: 300, allowUnknown: true },
  { key: "province", kind: "province" },
];

const QKEY: Record<Step["key"], keyof Dictionary["risk"]> = {
  sex: "sex", age: "age", heightCm: "height", weightKg: "weight", waistCm: "waist", physicallyActive: "activity",
  dailyVegFruit: "vegFruit", bpMedication: "bpMeds", highGlucoseHistory: "highGlucose", familyHistory: "family",
  smoker: "smoker", sbp: "sbp", province: "province",
};

type Phase = "urgent" | "goNow" | "questions" | "submitting" | "results" | "error";

export function RiskFlow({
  lang, t, demo, orgCode, provinces,
}: { lang: Locale; t: Dictionary; demo: boolean; orgCode: string | null; provinces: string[] }) {
  const [phase, setPhase] = useState<Phase>(demo ? "questions" : "urgent");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(demo ? DEMO_ANSWERS : {});
  const [result, setResult] = useState<RiskApiResult | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [phase, stepIndex]);

  const step = STEPS[stepIndex];
  const total = STEPS.length;

  function set<K extends keyof Answers>(k: K, v: Answers[K]) {
    setAnswers((a) => ({ ...a, [k]: v }));
  }

  function next() {
    if (stepIndex < total - 1) setStepIndex(stepIndex + 1);
    else void submit();
  }

  async function submit() {
    setPhase("submitting");
    try {
      const res = await fetch(API_BASE + "/api/risk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...answers, channel: "web", orgCode, save: !demo }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setResult(await res.json());
      setPhase("results");
      window.scrollTo({ top: 0 });
    } catch {
      setPhase("error");
    }
  }

  if (phase === "urgent")
    return (
      <UrgentScreen
        t={t}
        headingRef={headingRef}
        onUrgent={() => setPhase("goNow")}
        onSafe={() => setPhase("questions")}
      />
    );

  if (phase === "goNow") return <GoNowScreen lang={lang} t={t} headingRef={headingRef} onContinue={() => setPhase("questions")} />;

  if (phase === "submitting") return <LoadingState message={t.common.calculating} />;

  if (phase === "error")
    return (
      <div className="flex flex-col gap-4 pt-6" role="alert">
        <p>{t.common.error}</p>
        <button className="btn-primary" onClick={submit}>{t.common.tryAgain}</button>
      </div>
    );

  if (phase === "results" && result)
    return (
      <ResultsView
        lang={lang}
        t={t}
        result={result}
        onRestart={() => {
          setAnswers({});
          setStepIndex(0);
          setResult(null);
          setPhase("urgent");
        }}
      />
    );

  const q = t.risk[QKEY[step.key]] as { q: string; help?: string; unit?: string; info?: string };

  return (
    <div className="flex flex-col gap-5 pt-2">
      {demo && <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm">{t.common.demoBanner}</p>}
      <div>
        <p className="mb-1 text-sm text-muted">{fmtClient(t.common.stepOf, { n: stepIndex + 1, total }, lang)}</p>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-foreground/10"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={stepIndex + 1}
          aria-label={t.risk.title}
        >
          <div className="h-full bg-brand transition-all" style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
        </div>
      </div>

      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold leading-snug outline-none">{q.q}</h1>
      {q.help && <p className="text-muted">{q.help}</p>}
      {q.info && <InfoTip label={t.common.whatIsThis}>{q.info}</InfoTip>}

      <StepInput key={step.key} step={step} t={t} answers={answers} set={set} next={next} provinces={provinces} lang={lang} />

      <div className="mt-2 flex items-center justify-between">
        {stepIndex > 0 ? (
          <button className="btn-ghost" onClick={() => setStepIndex(stepIndex - 1)}>← {t.common.back}</button>
        ) : <span />}
        {/* Choice steps auto-advance; when an answer already exists (demo mode, or after going back) offer Next. */}
        {(step.kind === "yesno" || step.kind === "choice") && answers[step.key] !== undefined && (
          <button className="btn-ghost" onClick={next}>{t.common.next} →</button>
        )}
      </div>
    </div>
  );
}

function StepInput({
  step, t, answers, set, next, provinces, lang,
}: {
  step: Step; t: Dictionary; answers: Answers; lang: Locale; provinces: string[];
  set: <K extends keyof Answers>(k: K, v: Answers[K]) => void; next: () => void;
}) {
  const choose = <K extends keyof Answers>(k: K, v: Answers[K]) => {
    set(k, v);
    setTimeout(next, 120);
  };

  if (step.kind === "yesno") {
    const v = answers[step.key];
    return (
      <div className="flex flex-col gap-3">
        <ChoiceButton selected={v === true} onClick={() => choose(step.key, true)}>{t.common.yes}</ChoiceButton>
        <ChoiceButton selected={v === false} onClick={() => choose(step.key, false)}>{t.common.no}</ChoiceButton>
      </div>
    );
  }

  if (step.kind === "choice" && step.key === "sex") {
    return (
      <div className="flex flex-col gap-3">
        <ChoiceButton selected={answers.sex === "male"} onClick={() => choose("sex", "male")}>👨 {t.risk.sex.male}</ChoiceButton>
        <ChoiceButton selected={answers.sex === "female"} onClick={() => choose("sex", "female")}>👩 {t.risk.sex.female}</ChoiceButton>
      </div>
    );
  }

  if (step.kind === "choice" && step.key === "familyHistory") {
    const opts = [["none", t.risk.family.none], ["second_degree", t.risk.family.second], ["first_degree", t.risk.family.first]] as const;
    return (
      <div className="flex flex-col gap-3">
        {opts.map(([v, label]) => (
          <ChoiceButton key={v} selected={answers.familyHistory === v} onClick={() => choose("familyHistory", v)}>{label}</ChoiceButton>
        ))}
      </div>
    );
  }

  if (step.kind === "province") {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="sr-only">{t.risk.province.q}</span>
          <select
            className="min-h-14 rounded-xl border-2 border-line bg-surface px-4 text-lg"
            value={answers.province ?? ""}
            onChange={(e) => set("province", e.target.value || null)}
          >
            <option value="">{t.map.select}</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <button className="btn-primary" onClick={next} disabled={!answers.province}>{t.risk.submit}</button>
        <button className="btn-secondary" onClick={() => { set("province", null); setTimeout(next, 0); }}>{t.risk.province.skip}</button>
      </div>
    );
  }

  if (step.kind !== "number") return null;
  return <NumberStep step={step} t={t} answers={answers} set={set} next={next} lang={lang} />;
}

function NumberStep({
  step, t, answers, set, next, lang,
}: {
  step: Extract<Step, { kind: "number" }>; t: Dictionary; answers: Answers; lang: Locale;
  set: <K extends keyof Answers>(k: K, v: Answers[K]) => void; next: () => void;
}) {
  const current = answers[step.key];
  const [raw, setRaw] = useState(typeof current === "number" ? String(step.inches ? waistCmToInches(current) : current) : "");
  const [error, setError] = useState<string | null>(null);
  const unit = (t.risk[QKEY[step.key]] as { unit?: string }).unit;
  const id = `q-${step.key}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseNumberInput(raw);
    if (n === null || n < step.min || n > step.max) {
      setError(fmtClient(t.risk.invalidNumber, { min: step.min, max: step.max }, lang));
      return;
    }
    set(step.key, step.inches ? waistInchesToCm(n) : step.key === "age" || step.key === "sbp" ? Math.round(n) : n);
    next();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <label htmlFor={id} className="sr-only">{(t.risk[QKEY[step.key]] as { q: string }).q}</label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="min-h-14 w-40 rounded-xl border-2 border-line bg-surface px-4 text-2xl font-semibold"
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setError(null); }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <span className="text-lg text-muted">{unit}</span>
      </div>
      {error && <p id={`${id}-err`} className="font-medium text-[var(--danger)]" role="alert">{error}</p>}
      <button type="submit" className="btn-primary">{t.common.next} →</button>
      {step.allowUnknown && (
        <button type="button" className="btn-secondary" onClick={() => { set(step.key, null); next(); }}>
          {t.common.dontKnow}
        </button>
      )}
    </form>
  );
}

function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-14 rounded-xl border-2 px-5 py-3 text-left text-lg font-medium transition ${
        selected ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface hover:border-brand"
      }`}
    >
      {children}
    </button>
  );
}

export function UrgentScreen({
  t, headingRef, onUrgent, onSafe,
}: { t: Dictionary; headingRef: React.RefObject<HTMLHeadingElement | null>; onUrgent: () => void; onSafe: () => void }) {
  const items = [t.urgent.chestPain, t.urgent.fainting, t.urgent.highSugar];
  return (
    <div className="flex flex-col gap-4 pt-2">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--danger)]">🚨 {t.urgent.title}</p>
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold leading-snug outline-none">{t.urgent.question}</h1>
      <div className="flex flex-col gap-3">
        {items.map((label) => (
          <button
            key={label}
            onClick={onUrgent}
            className="min-h-14 rounded-xl border-2 border-[var(--danger-border)] bg-[var(--danger-soft)] px-5 py-3 text-left text-lg font-medium hover:border-[var(--danger)]"
          >
            {label}
          </button>
        ))}
        <button onClick={onSafe} className="btn-primary mt-2">✓ {t.urgent.none}</button>
      </div>
    </div>
  );
}

export function GoNowScreen({
  lang, t, headingRef, onContinue,
}: { lang: Locale; t: Dictionary; headingRef: React.RefObject<HTMLHeadingElement | null>; onContinue: () => void }) {
  const [hospitals, setHospitals] = useState<FacilityItem[] | null>(null);
  const [status, setStatus] = useState<"locating" | "denied" | "done">("locating");

  useEffect(() => {
    let cancelled = false;
    getPosition()
      .then(async ({ lat, lng }) => {
        if (!inCambodia(lat, lng)) throw new Error("outside");
        const r = await fetch(`${API_BASE}/api/facilities/nearest?lat=${lat}&lng=${lng}&limit=3&type=hospital`);
        const { facilities } = await r.json();
        if (!cancelled) { setHospitals(facilities); setStatus("done"); }
      })
      .catch(() => !cancelled && setStatus("denied"));
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col gap-4 pt-2" role="alert">
      <div className="rounded-2xl bg-[var(--danger-solid)] p-5 text-white">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">🚑 {t.urgent.goNowTitle}</h1>
        <p className="mt-2">{t.urgent.goNowBody}</p>
        <a href="tel:119" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-white px-4 text-lg font-bold text-[var(--danger)]">
          📞 {t.urgent.ambulance}
        </a>
      </div>
      <h2 className="text-xl font-bold">{t.urgent.nearestHospital}</h2>
      {status === "locating" && <p role="status">{t.map.locating}</p>}
      {status === "denied" && (
        <p>
          {t.map.locationDenied}{" "}
          <a className="font-semibold text-brand-strong underline" href={`${BASE_PATH}/${lang}/map?type=hospital`}>{t.common.findCare}</a>
        </p>
      )}
      {hospitals && <FacilityList items={hospitals} lang={lang} t={t} />}
      <button className="btn-ghost mt-4 text-sm" onClick={onContinue}>{t.urgent.continue}</button>
    </div>
  );
}
