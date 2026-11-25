"use client";

import { API_BASE } from "@/lib/client/api-base";
import { useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { OrgStats } from "@/lib/orgStats";
import { fmtClient, toKhmerDigits } from "@/lib/client/util";

interface PlanJson {
  province: { pcode: string; name: string };
  districtsInProvince: number;
  top: {
    pcode: string; name: string; rankInProvince: number; rankNational: number; index: number; drivers: string[];
    population: number; adults: number | null; travelMotorMin: number | null; pctWalkOver60: number | null; facilitiesPer10k: number | null;
    healthCentres: { name: string }[];
  }[];
  dhs: Record<string, number | null>;
  nationalDiabetes: { value: number; year: number } | null;
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function ScreeningPlanner({
  lang, t, provinces, stats, orgCode,
}: { lang: Locale; t: Dictionary; provinces: { pcode: string; name: string }[]; stats: OrgStats; orgCode: string }) {
  const p = t.planner;
  const initial = provinces.find((x) => x.name === stats.mainProvince)?.pcode ?? "";
  const [province, setProvince] = useState(initial);
  const [plan, setPlan] = useState<PlanJson | null>(null);
  const [loading, setLoading] = useState(false);
  const num = (v: number) => (lang === "km" ? toKhmerDigits(v.toLocaleString("en")) : v.toLocaleString("en"));

  async function load(pc: string) {
    setProvince(pc);
    setPlan(null);
    if (!pc) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/planner/${pc}`);
      setPlan(res.ok ? await res.json() : null);
    } finally {
      setLoading(false);
    }
  }
  // Pre-select the organization's main province (only known when ≥ 5 screenings come from it).
  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/planner/${initial}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setPlan(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [initial]);

  function downloadCsv() {
    if (!plan) return;
    const rows = plan.top.map((d) => [
      d.rankInProvince, d.name, d.pcode, d.index, d.rankNational, d.drivers.map((x) => t.insights.components[x as keyof typeof t.insights.components]).join("; "),
      d.adults, d.population, d.travelMotorMin, d.pctWalkOver60, d.facilitiesPer10k, d.healthCentres.map((h) => h.name).join("; "),
    ]);
    const csv = [p.csvHeader.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n") + "\n";
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sokhapheap_screening_plan_${plan.province.pcode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = stats.total;
  const pct = total && stats.moderatePlus !== null ? Math.round((100 * stats.moderatePlus) / total) : null;
  const r1 = (v: number | null | undefined) => (v === null || v === undefined ? "—" : Math.round(v * 10) / 10);

  return (
    <section aria-labelledby="planner-title" className="flex flex-col gap-3 rounded-2xl border-2 border-brand bg-surface p-4">
      <h2 id="planner-title" className="text-xl font-bold">🗺️ {p.title}</h2>
      <p className="text-sm">{p.intro}</p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {p.province}
        <select className="field" value={province} onChange={(e) => load(e.target.value)}>
          <option value="">{p.select}</option>
          {provinces.map((x) => <option key={x.pcode} value={x.pcode}>{x.name}</option>)}
        </select>
      </label>
      {loading && <p role="status">{p.loading}</p>}

      {plan && (
        <>
          <ol className="flex flex-col gap-3" aria-live="polite">
            {plan.top.map((d) => (
              <li key={d.pcode} className="rounded-xl border border-line p-3">
                <p className="text-lg font-bold">{num(d.rankInProvince)}. {d.name}</p>
                <p className="text-sm text-muted">{p.colIndex}: {num(d.index)} · {fmtClient(p.nationalRank, { rank: d.rankNational }, lang)}</p>
                <p className="mt-1 text-sm"><span className="font-medium">{p.colDrivers}:</span> {d.drivers.map((x) => t.insights.components[x as keyof typeof t.insights.components]).join(", ") || "—"}</p>
                <p className="text-sm">
                  <span className="font-medium">{p.colAdults}:</span> {d.adults === null ? "—" : num(d.adults)} ·{" "}
                  <span className="font-medium">{p.colTravel}:</span> {typeof r1(d.travelMotorMin) === "number" ? num(r1(d.travelMotorMin) as number) : "—"}
                </p>
                <p className="mt-1 text-sm font-medium">{p.colCentres}:</p>
                {d.healthCentres.length ? (
                  <p className="text-sm">
                    {d.healthCentres.slice(0, 4).map((h) => h.name).join(", ")}
                    {d.healthCentres.length > 4 ? ` ${fmtClient(p.moreCentres, { n: d.healthCentres.length - 4 }, lang)}` : ""}
                  </p>
                ) : <p className="text-sm text-muted">{p.noCentres}</p>}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={downloadCsv}>⬇️ {p.csv}</button>
            <a className="btn-secondary" href={`/${lang}/plan/${plan.province.pcode}?org=${encodeURIComponent(orgCode)}`} target="_blank" rel="noopener">🖨️ {p.print}</a>
          </div>

          <div className="rounded-xl bg-brand-soft p-3 text-sm">
            <h3 className="font-semibold">{p.compareTitle}</h3>
            <p className="mt-1">
              {pct === null || total === null || stats.moderatePlus === null
                ? p.compareHidden
                : fmtClient(p.compareYours, { n: stats.moderatePlus, total, pct }, lang)}
            </p>
            <p className="mt-1">
              {fmtClient(p.compareArea, {
                province: plan.province.name,
                owt: r1(plan.dhs.women_overweight_or_obese_pct) as number,
                smoke: r1(plan.dhs.men_smoke_tobacco_pct) as number,
                dm: plan.nationalDiabetes?.value ?? 0,
                dmYear: plan.nationalDiabetes?.year ?? 0,
              }, lang)}
            </p>
            <p className="mt-1 text-xs text-muted">ℹ️ {p.compareNote}</p>
          </div>
        </>
      )}
    </section>
  );
}
