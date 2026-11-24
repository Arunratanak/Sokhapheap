"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { fmtClient } from "@/lib/client/util";
import { Disclaimer } from "@/components/Disclaimer";
import { AreaCard } from "@/components/area/AreaCard";
import type { FindriscBand, FindriscResult } from "@/lib/scoring/findrisc";
import type { CvdBand, CvdResult } from "@/lib/scoring/whoCvd";
import type { NextStep } from "@/lib/risk";
import { LoadingState } from "@/components/ui/LoadingState";

export interface RiskApiResult {
  findrisc: FindriscResult;
  cvd: CvdResult;
  nextStep: NextStep;
  saved: boolean;
}

// Colour + icon + words: never colour alone.
const FINDRISC_STYLE: Record<FindriscBand, { bg: string; fg: string; icon: string; level: number }> = {
  low: { bg: "var(--ok-bg)", fg: "var(--ok-fg)", icon: "🟢", level: 1 },
  slightly_elevated: { bg: "var(--lime-bg)", fg: "var(--lime-fg)", icon: "🟡", level: 2 },
  moderate: { bg: "var(--caution-bg)", fg: "var(--caution-fg)", icon: "🟠", level: 3 },
  high: { bg: "var(--orange-bg)", fg: "var(--orange-fg)", icon: "🔴", level: 4 },
  very_high: { bg: "var(--danger-bg)", fg: "var(--danger-fg)", icon: "🔴", level: 5 },
};
const CVD_STYLE: Record<CvdBand, { bg: string; fg: string; icon: string; level: number }> = {
  "<5": FINDRISC_STYLE.low,
  "5-10": FINDRISC_STYLE.slightly_elevated,
  "10-20": FINDRISC_STYLE.moderate,
  "20-30": FINDRISC_STYLE.high,
  ">=30": FINDRISC_STYLE.very_high,
};

function LevelMeter({ level, label }: { level: number; label: string }) {
  return (
    <div className="mt-3 flex gap-1" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="h-2 flex-1 rounded-full" style={{ background: i <= level ? "currentColor" : "rgba(0,0,0,0.12)" }} />
      ))}
    </div>
  );
}

export function ResultsView({
  lang, t, result, onRestart,
}: { lang: Locale; t: Dictionary; result: RiskApiResult; onRestart: () => void }) {
  const { findrisc: f, cvd, nextStep } = result;
  const fs = FINDRISC_STYLE[f.band];
  const [explanation, setExplanation] = useState<{ text: string; source: "ai" | "template" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lang,
        kind: "risk",
        risk: {
          findrisc: { score: f.score, scoreMax: f.scoreMax, band: f.band, factors: f.factors, recommendGlucoseTest: f.recommendGlucoseTest },
          cvd: cvd.available ? { available: true, band: cvd.band } : { available: false, reason: cvd.reason },
        },
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((e) => !cancelled && e && setExplanation(e))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lang, f, cvd]);

  const scoreText = f.incomplete.length
    ? fmtClient(t.results.diabetesScoreRange, { score: f.score, max: f.scoreMax }, lang)
    : fmtClient(t.results.diabetesScore, { score: f.score }, lang);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <h1 className="text-2xl font-bold">{t.results.title}</h1>

      <section className="rounded-2xl p-5" style={{ background: fs.bg, color: fs.fg }} aria-labelledby="dm-title">
        <h2 id="dm-title" className="text-base font-semibold">{t.results.diabetesTitle}</h2>
        <p className="mt-1 text-2xl font-bold">{fs.icon} {t.results.findriscBands[f.band]}</p>
        <LevelMeter level={fs.level} label={t.results.findriscBands[f.band]} />
        <p className="mt-2 text-sm">{scoreText} · {fmtClient(t.results.bmiLabel, { bmi: f.bmi }, lang)}</p>
        {f.recommendGlucoseTest && <p className="mt-1 text-sm font-semibold">🩸 {t.results.glucoseTestRecommended}</p>}
      </section>

      <section
        className="rounded-2xl p-5"
        style={cvd.available ? { background: CVD_STYLE[cvd.band].bg, color: CVD_STYLE[cvd.band].fg } : { background: "var(--neutral-bg)", color: "var(--neutral-fg)" }}
        aria-labelledby="cvd-title"
      >
        <h2 id="cvd-title" className="text-base font-semibold">{t.results.heartTitle}</h2>
        {cvd.available ? (
          <>
            <p className="mt-1 text-2xl font-bold">{CVD_STYLE[cvd.band].icon} {t.results.cvdBands[cvd.band]}</p>
            <LevelMeter level={CVD_STYLE[cvd.band].level} label={t.results.cvdBands[cvd.band]} />
          </>
        ) : (
          <p className="mt-2 text-lg font-semibold">🩺 {t.results.cvdUnavailable[cvd.reason]}</p>
        )}
      </section>

      <section aria-labelledby="factors-title">
        <h2 id="factors-title" className="text-lg font-bold">{t.results.factorsTitle}</h2>
        {f.factors.length ? (
          <ul className="mt-2 flex flex-col gap-2">
            {f.factors.slice(0, 3).map((x) => (
              <li key={x.factor} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 shadow-sm">
                <span aria-hidden>•</span> {t.results.factors[x.factor]}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted">{t.results.noFactors}</p>
        )}
      </section>

      <section className="rounded-2xl border-2 border-brand bg-brand-soft p-5" aria-labelledby="next-title">
        <h2 id="next-title" className="text-lg font-bold text-brand-strong">👉 {t.results.nextStepTitle}</h2>
        <p className="mt-1 text-lg">{t.results.nextSteps[nextStep]}</p>
      </section>

      <section aria-labelledby="exp-title" aria-live="polite">
        <h2 id="exp-title" className="text-lg font-bold">{t.results.explanationTitle}</h2>
        {explanation ? (
          <>
            <p className="mt-1">{explanation.text}</p>
            <p className="mt-1 text-xs text-muted">{explanation.source === "ai" ? t.results.aiNote : t.results.templateNote}</p>
          </>
        ) : (
          <LoadingState compact message={t.common.explaining} />
        )}
      </section>

      <AreaCard lang={lang} t={t} />

      <Disclaimer text={t.common.disclaimer} />

      <Link href={`/${lang}/map`} className="btn-primary text-center">📍 {t.common.findCare}</Link>
      <p className="text-center text-sm text-muted">{t.results.printNote}</p>
      <button className="btn-ghost" onClick={onRestart}>↺ {t.results.startOver}</button>
    </div>
  );
}
