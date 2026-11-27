"use client";

import { API_BASE } from "@/lib/client/api-base";
import { useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { CVD_BANDS, FINDRISC_BANDS, type OrgStats, type SafeCount } from "@/domain/orgStats";
import { toKhmerDigits } from "@/lib/client/util";
import { ScreeningPlanner } from "./ScreeningPlanner";
import { FlaskConical, Lock } from "lucide-react";

const COLORS = ["var(--status-normal)", "var(--status-borderline)", "var(--status-borderline)", "var(--status-out)", "var(--status-out)", "var(--text-tertiary)"];

function Bars({ title, rows, lang, t }: { title: string; rows: { label: string; value: SafeCount }[]; lang: Locale; t: Dictionary }) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  const n = (v: number) => (lang === "km" ? toKhmerDigits(v) : String(v));
  return (
    <section className="card p-5">
      <h2 className="mb-3 text-h3 font-semibold">{title}</h2>
      <table className="w-full text-label">
        <caption className="sr-only">{title}</caption>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label}>
              <th scope="row" className="w-2/5 py-1.5 pr-2 text-left font-medium">{r.label}</th>
              <td className="py-1.5">
                {r.value === null ? (
                  <span className="text-secondary">{t.org.hidden}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0, background: COLORS[i] }} aria-hidden />
                    <span className="font-semibold tabular-nums">{n(r.value)}</span>
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
    const res = await fetch(`${API_BASE}/api/org/${encodeURIComponent(code)}`, {
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
        <label className="flex flex-col gap-1 text-label font-medium">
          {t.org.codePrompt}
          <input type="password" className="field" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} autoComplete="off" />
        </label>
        {state === "error" && <p role="alert" className="text-caption text-status-out">{error}</p>}
        <button className="btn-primary" disabled={!accessCode || state === "loading"}>{state === "loading" ? t.common.loading : t.org.submit}</button>
      </form>
    );

  const s = data.stats;
  const total = s.total === null ? t.org.hidden : lang === "km" ? toKhmerDigits(s.total) : String(s.total);
  return (
    <div className="flex flex-col gap-4">
      {s.isDemo && <p className="flex items-center gap-2 rounded-xl border border-dashed border-border-strong px-3 py-2 text-caption text-secondary"><FlaskConical aria-hidden size={16} />{t.org.demoData}</p>}
      <p className="text-h2 font-semibold">{data.name}</p>
      <p className="text-body">{t.org.total}: <strong className="font-semibold tabular-nums">{total}</strong></p>
      <Bars title={t.org.diabetesByBand} lang={lang} t={t} rows={FINDRISC_BANDS.map((b) => ({ label: t.results.findriscBands[b], value: s.findrisc[b] }))} />
      <Bars
        title={t.org.heartByBand}
        lang={lang}
        t={t}
        rows={CVD_BANDS.map((b) => ({ label: b === "unknown" ? t.org.unknownCvd : t.results.cvdBands[b], value: s.cvd[b] }))}
      />
      <p className="flex items-start gap-2 text-caption text-secondary"><Lock aria-hidden size={16} className="mt-0.5 shrink-0" />{t.org.privacyNote}</p>
      <ScreeningPlanner lang={lang} t={t} provinces={provinces} stats={s} orgCode={code} />
    </div>
  );
}
