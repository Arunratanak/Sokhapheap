"use client";

import { API_BASE } from "@/lib/client/api-base";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n";
import { fmtClient } from "@/lib/client/util";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { AreaCard } from "@/components/features/area/AreaCard";
import type { FindriscBand, FindriscResult } from "@/domain/scoring/findrisc";
import type { CvdBand, CvdResult } from "@/domain/scoring/whoCvd";
import type { NextStep } from "@/domain/risk";
import { SaveRecordButton } from "@/components/features/account/SaveRecordButton";
import { riskRecord } from "@/domain/records";
import { AiCard, SkeletonLines, StatusChip, lookFromCvd, lookFromFindrisc, statusVar, type StatusLook } from "@/components/ui/Status";
import { Droplet, MapPin, RotateCcw } from "lucide-react";

export interface RiskApiResult {
  findrisc: FindriscResult;
  cvd: CvdResult;
  nextStep: NextStep;
  saved: boolean;
}

// Position of each band on the 5-step meter (display only). Colour + icon + words: never colour alone.
const FINDRISC_LEVEL: Record<FindriscBand, number> = { low: 1, slightly_elevated: 2, moderate: 3, high: 4, very_high: 5 };
const CVD_LEVEL: Record<CvdBand, number> = { "<5": 1, "5-10": 2, "10-20": 3, "20-30": 4, ">=30": 5 };

/** Five-step level meter: filled steps in the status colour on the surface-3 track. */
function LevelMeter({ level, label, look }: { level: number; label: string; look: StatusLook }) {
  return (
    <div className="mt-4 flex gap-1" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= level ? "" : "bg-surface-3"}`} style={i <= level ? { background: statusVar(look.status) } : undefined} />
      ))}
    </div>
  );
}

export function ResultsView({
  lang, t, result, onRestart,
}: { lang: Locale; t: Dictionary; result: RiskApiResult; onRestart: () => void }) {
  const { findrisc: f, cvd, nextStep } = result;
  const fLook = lookFromFindrisc(f.band);
  const [explanation, setExplanation] = useState<{ text: string; source: "ai" | "template" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(API_BASE + "/api/explain", {
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
      <h1 className="text-h1 font-semibold">{t.results.title}</h1>

      {/* Neutral cards; status colour only on the chip and the meter (DESIGN.md §3.3). */}
      <section className="card p-5" aria-labelledby="dm-title">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 id="dm-title" className="text-h3 font-semibold">{t.results.diabetesTitle}</h2>
          <StatusChip look={fLook} label={t.results.findriscBands[f.band]} />
        </div>
        <LevelMeter level={FINDRISC_LEVEL[f.band]} look={fLook} label={t.results.findriscBands[f.band]} />
        <p className="mt-3 text-caption text-secondary">{scoreText} · {fmtClient(t.results.bmiLabel, { bmi: f.bmi }, lang)}</p>
        {f.recommendGlucoseTest && (
          <p className="mt-2 flex items-start gap-2 text-body"><Droplet aria-hidden size={20} className="mt-0.5 shrink-0 text-secondary" />{t.results.glucoseTestRecommended}</p>
        )}
      </section>

      <section className="card p-5" aria-labelledby="cvd-title">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 id="cvd-title" className="text-h3 font-semibold">{t.results.heartTitle}</h2>
          {cvd.available && <StatusChip look={lookFromCvd(cvd.band)} label={t.results.cvdBands[cvd.band]} />}
        </div>
        {cvd.available ? (
          <LevelMeter level={CVD_LEVEL[cvd.band]} look={lookFromCvd(cvd.band)} label={t.results.cvdBands[cvd.band]} />
        ) : (
          <div className="mt-3 flex flex-col items-start gap-2">
            <StatusChip look={{ status: "none" }} label={t.lab.flags.could_not_read} />
            <p className="text-body">{t.results.cvdUnavailable[cvd.reason]}</p>
          </div>
        )}
      </section>

      <section className="card p-5" aria-labelledby="next-title">
        <h2 id="next-title" className="eyebrow">{t.results.nextStepTitle}</h2>
        <p className="mt-1 text-body">{t.results.nextSteps[nextStep]}</p>
      </section>

      <section aria-labelledby="factors-title">
        <h2 id="factors-title" className="text-h3 font-semibold">{t.results.factorsTitle}</h2>
        {f.factors.length ? (
          <ul className="mt-2 flex flex-col gap-2">
            {f.factors.slice(0, 3).map((x) => (
              <li key={x.factor} className="rounded-xl border border-border bg-surface-1 px-4 py-3 text-body">
                {t.results.factors[x.factor]}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-secondary">{t.results.noFactors}</p>
        )}
      </section>

      <AiCard
        label={t.results.explanationTitle}
        live
        note={explanation ? (explanation.source === "ai" ? t.results.aiNote : t.results.templateNote) : undefined}
      >
        {explanation ? <p>{explanation.text}</p> : (
          <div role="status" className="flex flex-col gap-3">
            <p className="text-secondary">{t.common.explaining}</p>
            <SkeletonLines />
          </div>
        )}
      </AiCard>

      <SaveRecordButton lang={lang} t={t} record={riskRecord(result)} />

      <AreaCard lang={lang} t={t} />

      <Link href={`/${lang}/map`} className="btn-primary"><MapPin aria-hidden size={20} /> {t.common.findCare}</Link>
      <Disclaimer text={t.common.disclaimer} />
      <p className="text-caption text-secondary">{t.results.printNote}</p>
      <button className="btn-ghost" onClick={onRestart}><RotateCcw aria-hidden size={16} /> {t.results.startOver}</button>
    </div>
  );
}
