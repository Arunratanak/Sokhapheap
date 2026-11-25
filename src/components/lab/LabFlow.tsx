"use client";

import { API_BASE } from "@/lib/client/api-base";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { parseNumberInput } from "@/lib/client/util";
import { Disclaimer } from "@/components/Disclaimer";
import type { EvaluatedLabValue, ExtractedLabValue } from "@/lib/scoring/labRanges";
import { LoadingState } from "@/components/ui/LoadingState";

type Stage = "upload" | "reading" | "confirm" | "evaluating" | "results";
interface Row { test_name: string; value: string; unit: string; low: string; high: string; confidence: number }

const toRow = (v: ExtractedLabValue): Row => ({
  test_name: v.test_name,
  value: v.value === null ? "" : String(v.value),
  unit: v.unit ?? "",
  low: v.printed_range_low === null ? "" : String(v.printed_range_low),
  high: v.printed_range_high === null ? "" : String(v.printed_range_high),
  confidence: v.confidence,
});
const emptyRow = (): Row => ({ test_name: "", value: "", unit: "mg/dL", low: "", high: "", confidence: 1 });

/** Shrink large phone photos before upload (faster on slow networks). Falls back to the original. */
async function downscale(file: File, max = 1800): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}

const FLAG_STYLE = {
  normal: { icon: "✅", bg: "var(--ok-bg)", fg: "var(--ok-fg)" },
  outside_range: { icon: "⚠️", bg: "var(--orange-bg)", fg: "var(--orange-fg)" },
  could_not_read: { icon: "❔", bg: "var(--neutral-bg)", fg: "var(--neutral-fg)" },
} as const;

export function LabFlow({ lang, t }: { lang: Locale; t: Dictionary }) {
  const [stage, setStage] = useState<Stage>("upload");
  const [rows, setRows] = useState<Row[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<EvaluatedLabValue[]>([]);
  const [explanation, setExplanation] = useState<{ text: string; source: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setNotice(null);
    setStage("reading");
    try {
      const fd = new FormData();
      const blob = await downscale(file);
      fd.set("image", blob instanceof File ? blob : new File([blob], "report.jpg", { type: "image/jpeg" }));
      const res = await fetch(API_BASE + "/api/lab/extract", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(res.status === 503 ? t.lab.aiUnavailable : t.common.error);
        setRows([emptyRow()]);
      } else if (!body.values?.length) {
        setNotice(t.lab.nothingFound);
        setRows([emptyRow()]);
      } else {
        setRows((body.values as ExtractedLabValue[]).map(toRow));
      }
    } catch {
      setNotice(t.lab.aiUnavailable);
      setRows([emptyRow()]);
    } finally {
      if (fileRef.current) fileRef.current.value = ""; // drop the file from the input
      setStage("confirm");
    }
  }

  async function evaluate() {
    const values = rows
      .filter((r) => r.test_name.trim())
      .map((r) => ({
        test_name: r.test_name.trim(),
        value: parseNumberInput(r.value),
        unit: r.unit.trim() || null,
        printed_range_low: parseNumberInput(r.low),
        printed_range_high: parseNumberInput(r.high),
        // The person has checked the numbers, so their confirmation counts as full confidence,
        // except for rows still left blank.
        confidence: parseNumberInput(r.value) === null ? r.confidence : 1,
      }));
    if (!values.length) return;
    setStage("evaluating");
    try {
      const res = await fetch(API_BASE + "/api/lab/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) throw new Error();
      const { results } = await res.json();
      setResults(results);
      setStage("results");
      window.scrollTo({ top: 0 });
    } catch {
      setNotice(t.common.error);
      setStage("confirm");
    }
  }

  useEffect(() => {
    if (stage !== "results" || !results.length) return;
    let cancelled = false;
    fetch(API_BASE + "/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lang,
        kind: "lab",
        lab: results.slice(0, 20).map((r) => ({
          test: (r.name ? r.name[lang] : r.printedName).slice(0, 60),
          value: r.value,
          unit: r.unit ? r.unit.slice(0, 20) : null,
          flag: r.flag,
          ...(r.direction ? { direction: r.direction } : {}),
        })),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((e) => !cancelled && e && setExplanation(e))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [stage, results, lang]);

  const update = (i: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  if (stage === "upload" || stage === "reading")
    return (
      <div className="flex flex-col gap-4 pt-2">
        <h1 className="text-2xl font-bold">{t.lab.title}</h1>
        <p>{t.lab.intro}</p>
        <p className="text-sm text-muted">{t.lab.photoTips}</p>
        <label className={`btn-primary cursor-pointer ${stage === "reading" ? "pointer-events-none opacity-60" : ""}`}>
          📷 {stage === "reading" ? t.lab.reading : t.lab.takePhoto}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={stage === "reading"}
          />
        </label>
        {stage === "reading" && <LoadingState message={t.common.readingReport} delayMs={0} />}
        <button className="btn-secondary" onClick={() => { setRows([emptyRow()]); setStage("confirm"); }}>
          ⌨️ {t.lab.typeManually}
        </button>
        <p className="text-sm text-muted">🔒 {t.lab.privacyNote}</p>
      </div>
    );

  if (stage === "confirm" || stage === "evaluating")
    return (
      <div className="flex flex-col gap-4 pt-2">
        <h1 className="text-2xl font-bold">{t.lab.confirmTitle}</h1>
        {notice && <p className="rounded-lg bg-warn-soft px-3 py-2" role="status">{notice}</p>}
        <p className="text-muted">{t.lab.confirmIntro}</p>
        <ul className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <li key={i} className={`rounded-xl border bg-surface p-3 shadow-sm ${r.confidence < 0.7 ? "border-warn-border" : "border-line"}`}>
              <div className="grid grid-cols-6 gap-2">
                <label className="col-span-6 flex flex-col gap-1 text-xs font-medium">
                  {t.lab.testName}
                  <input className="field" value={r.test_name} onChange={(e) => update(i, "test_name", e.target.value)} />
                </label>
                <label className="col-span-3 flex flex-col gap-1 text-xs font-medium">
                  {t.lab.value}
                  <input className="field text-lg font-semibold" inputMode="decimal" value={r.value} onChange={(e) => update(i, "value", e.target.value)} />
                </label>
                <label className="col-span-3 flex flex-col gap-1 text-xs font-medium">
                  {t.lab.unit}
                  <input className="field" value={r.unit} onChange={(e) => update(i, "unit", e.target.value)} />
                </label>
                <fieldset className="col-span-6 grid grid-cols-2 gap-2">
                  <legend className="mb-1 text-xs font-medium">{t.lab.range}</legend>
                  <input aria-label={`${t.lab.range} min`} placeholder="min" className="field" inputMode="decimal" value={r.low} onChange={(e) => update(i, "low", e.target.value)} />
                  <input aria-label={`${t.lab.range} max`} placeholder="max" className="field" inputMode="decimal" value={r.high} onChange={(e) => update(i, "high", e.target.value)} />
                </fieldset>
              </div>
              <button className="mt-2 text-sm text-[var(--danger)] underline" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                {t.lab.remove}
              </button>
            </li>
          ))}
        </ul>
        <button className="btn-secondary" onClick={() => setRows((rs) => [...rs, emptyRow()])}>＋ {t.lab.addRow}</button>
        <button className="btn-primary" onClick={evaluate} disabled={stage === "evaluating" || !rows.some((r) => r.test_name.trim())}>
          {stage === "evaluating" ? t.common.loading : t.lab.evaluate}
        </button>
        <button className="btn-ghost" onClick={() => { setRows([]); setNotice(null); setStage("upload"); }}>← {t.common.back}</button>
      </div>
    );

  const anyOutside = results.some((r) => r.flag === "outside_range");
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-2xl font-bold">{t.lab.resultsTitle}</h1>
      <ul className="flex flex-col gap-3">
        {results.map((r, i) => {
          const s = FLAG_STYLE[r.flag];
          const range = r.rangeUsed
            ? `${r.rangeUsed.low ?? ""}${r.rangeUsed.low !== null && r.rangeUsed.high !== null ? "–" : r.rangeUsed.low !== null ? "+" : "< "}${r.rangeUsed.high ?? ""} ${r.rangeUsed.unit}`
            : null;
          return (
            <li key={i} className="rounded-xl p-4" style={{ background: s.bg, color: s.fg }}>
              <p className="font-semibold">{r.name ? r.name[lang] : r.printedName}</p>
              <p className="text-2xl font-bold">{r.value ?? "—"} <span className="text-base font-medium">{r.unit}</span></p>
              <p className="font-semibold">
                {s.icon} {t.lab.flags[r.flag]}
                {r.direction && <> · {t.lab.direction[r.direction]}</>}
              </p>
              {range && <p className="text-sm">{t.lab.rangeSource[r.rangeUsed!.source]}: {range}</p>}
              {r.reason && <p className="text-sm">{t.lab.reasons[r.reason]}</p>}
            </li>
          );
        })}
      </ul>

      <section className="rounded-2xl border-2 border-brand bg-brand-soft p-5">
        <h2 className="text-lg font-bold text-brand-strong">👉 {t.results.nextStepTitle}</h2>
        <p className="mt-1 text-lg">{t.lab.nextSteps[anyOutside ? "lab_follow_up" : "lab_all_normal"]}</p>
      </section>

      <section aria-live="polite">
        <h2 className="text-lg font-bold">{t.results.explanationTitle}</h2>
        {explanation ? (
          <>
            <p className="mt-1">{explanation.text}</p>
            <p className="mt-1 text-xs text-muted">{explanation.source === "ai" ? t.results.aiNote : t.results.templateNote}</p>
          </>
        ) : (
          <LoadingState compact message={t.common.explaining} />
        )}
      </section>

      <Disclaimer text={t.common.disclaimer} />
      <Link href={`/${lang}/map`} className="btn-primary">📍 {t.common.findCare}</Link>
      <button className="btn-ghost" onClick={() => { setResults([]); setRows([]); setExplanation(null); setStage("upload"); }}>
        ↺ {t.results.startOver}
      </button>
    </div>
  );
}
