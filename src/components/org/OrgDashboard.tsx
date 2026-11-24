"use client";

import { useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { CVD_BANDS, FINDRISC_BANDS, type OrgStats, type SafeCount } from "@/lib/orgStats";
import { toKhmerDigits } from "@/lib/client/util";
import { ScreeningPlanner } from "./ScreeningPlanner";

const COLORS = ["#2f9e5b", "#a3b81f", "#e0a100", "#e8590c", "#c0262d", "#9aa4b2"];

function Bars({ title, rows, lang, t }: { title: string; rows: { label: string; value: SafeCount }[]; lang: Locale; t: Dictionary }) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  const n = (v: number) => (lang === "km" ? toKhmerDigits(v) : String(v));
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <table className="w-full text-sm">
        <caption className="sr-only">{title}</caption>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label}>
              <th scope="row" className="w-2/5 py-1.5 pr-2 text-left font-medium">{r.label}</th>
              <td className="py-1.5">
                {r.value === null ? (
                  <span className="text-muted italic">{t.org.hidden}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-5 rounded" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0, background: COLORS[i] }} aria-hidden />
                    <span className="font-semibold">{n(r.value)}</span>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function OrgDashboard({ code, lang, t, provinces }: { code: string; lang: Locale; t: Dictionary; provinces: { pcode: string; name: string }[] }) {
  const [accessCode, setAccessCode] = useState("");
  const [state, setState] = useState<"form" | "loading" | "error" | "ok">("form");
  const [error, setError] = useState("");
  const [data, setData] = useState<{ name: string; stats: OrgStats } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    const res = await fetch(`/api/org/${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessCode }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setError(res?.status === 401 || res?.status === 404 ? t.org.wrongCode : t.common.error);
      setState("error");
      return;
    }
    setData(await res.json());
    setState("ok");
  }

  if (state !== "ok" || !data)
    return (
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 font-medium">
          {t.org.codePrompt}
          <input type="password" className="field" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} autoComplete="off" />
        </label>
        {state === "error" && <p role="alert" className="font-medium text-[var(--danger)]">{error}</p>}
        <button className="btn-primary" disabled={!accessCode || state === "loading"}>{state === "loading" ? t.common.loading : t.org.submit}</button>
      </form>
    );

  const s = data.stats;
  const total = s.total === null ? t.org.hidden : lang === "km" ? toKhmerDigits(s.total) : String(s.total);
  return (
    <div className="flex flex-col gap-4">
      {s.isDemo && <p className="rounded-lg bg-warn-soft px-3 py-2 font-semibold">🧪 {t.org.demoData}</p>}
      <p className="text-xl font-bold">{data.name}</p>
      <p className="text-lg">{t.org.total}: <strong>{total}</strong></p>
      <Bars title={t.org.diabetesByBand} lang={lang} t={t} rows={FINDRISC_BANDS.map((b) => ({ label: t.results.findriscBands[b], value: s.findrisc[b] }))} />
      <Bars
        title={t.org.heartByBand}
        lang={lang}
        t={t}
        rows={CVD_BANDS.map((b) => ({ label: b === "unknown" ? t.org.unknownCvd : t.results.cvdBands[b], value: s.cvd[b] }))}
      />
      <p className="text-sm text-muted">🔒 {t.org.privacyNote}</p>
      <ScreeningPlanner lang={lang} t={t} provinces={provinces} stats={s} orgCode={code} />
    </div>
  );
}
