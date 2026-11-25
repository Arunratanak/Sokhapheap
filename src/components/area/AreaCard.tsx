"use client";

import { API_BASE } from "@/lib/client/api-base";
import Link from "next/link";
import { useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { fmtClient, getPosition, inCambodia, toKhmerDigits } from "@/lib/client/util";

/** Response of GET /api/area (see src/lib/insights/area.ts). */
export interface AreaSummaryJson {
  province: { pcode: string; name: string };
  district: { pcode: string; name: string };
  commune: { pcode: string; name: string } | null;
  womenOverweightPct: number | null;
  menSmokePct: number | null;
  travelMotorMin: number | null;
  pctWalkOver60: number | null;
  nearestHealthCentre: { name: string; nameKm: string | null; km: number; from: "you" | "commune_centre" } | null;
  nationalHypertensionPct: { value: number; year: number } | null;
  nationalDiabetesPct: { value: number; year: number } | null;
  vegPrice: { commodity: string; khrPerKg: number; from: string; to: string } | null;
  insightsLink: string;
}
type Options = { pcode: string; name: string; districts: { pcode: string; name: string }[] }[];

function Fact({ children, source }: { children: React.ReactNode; source: string }) {
  return (
    <li className="rounded-lg bg-surface px-3 py-2 shadow-sm">
      <p>{children}</p>
      <p className="mt-0.5 text-xs text-muted">{source}</p>
    </li>
  );
}

export function AreaCard({ lang, t }: { lang: Locale; t: Dictionary }) {
  const a = t.area;
  const [summary, setSummary] = useState<AreaSummaryJson | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "notfound" | "error">("idle");
  const [options, setOptions] = useState<Options | null>(null);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");

  async function loadOptions() {
    if (options) return;
    try {
      setOptions(await (await fetch(API_BASE + "/api/area/options")).json());
    } catch {
      setStatus("error");
    }
  }

  async function fetchArea(q: URLSearchParams) {
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/area?${q}`);
      if (res.status === 404) {
        setStatus("notfound");
        void loadOptions();
        return;
      }
      if (!res.ok) throw new Error();
      setSummary(await res.json());
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function useLocation() {
    setStatus("loading");
    try {
      const pos = await getPosition();
      if (!inCambodia(pos.lat, pos.lng)) {
        setStatus("notfound");
        void loadOptions();
        return;
      }
      // The coordinates go only to /api/area for this lookup; nothing is stored.
      await fetchArea(new URLSearchParams({ lat: pos.lat.toFixed(5), lng: pos.lng.toFixed(5) }));
    } catch {
      setStatus("notfound");
      void loadOptions();
    }
  }

  const districts = options?.find((p) => p.pcode === province)?.districts ?? [];
  const n = (v: number) => (Number.isInteger(v) ? v : Math.round(v * 10) / 10);

  return (
    <section aria-labelledby="area-title" aria-live="polite" className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-background p-4">
      <h2 id="area-title" className="text-lg font-bold">📊 {a.title}</h2>
      {!summary && (
        <>
          <p className="text-sm">{a.intro}</p>
          <button type="button" className="btn-secondary" onClick={useLocation} disabled={status === "loading"}>
            📍 {status === "loading" ? a.locating : a.useLocation}
          </button>
          {status === "notfound" && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm" role="status">{a.notFound}</p>}
          {status === "error" && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm" role="status">{a.error}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" onFocus={loadOptions} onPointerEnter={loadOptions}>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {a.chooseProvince}
              <select className="field" value={province} onChange={(e) => { setProvince(e.target.value); setDistrict(""); }} onClick={loadOptions}>
                <option value="">{a.select}</option>
                {options?.map((p) => <option key={p.pcode} value={p.pcode}>{p.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {a.chooseDistrict}
              <select className="field" value={district} disabled={!province} onChange={(e) => setDistrict(e.target.value)}>
                <option value="">{a.select}</option>
                {districts.map((d) => <option key={d.pcode} value={d.pcode}>{d.name}</option>)}
              </select>
            </label>
          </div>
          <button type="button" className="btn-primary" disabled={!district || status === "loading"} onClick={() => fetchArea(new URLSearchParams({ district }))}>
            {a.show}
          </button>
        </>
      )}

      {summary && (
        <>
          <p className="font-semibold">{fmtClient(a.heading, { district: summary.district.name, province: summary.province.name }, lang)}</p>
          <ul className="flex flex-col gap-2 text-sm">
            {summary.womenOverweightPct !== null && (
              <Fact source={a.srcDhs}>{fmtClient(a.overweight, { province: summary.province.name, pct: n(summary.womenOverweightPct) }, lang)}</Fact>
            )}
            {summary.menSmokePct !== null && (
              <Fact source={a.srcDhs}>{fmtClient(a.smoke, { province: summary.province.name, pct: n(summary.menSmokePct) }, lang)}</Fact>
            )}
            {summary.travelMotorMin !== null && summary.pctWalkOver60 !== null && (
              <Fact source={a.srcTravel}>
                {fmtClient(a.travel, { district: summary.district.name, min: Math.round(summary.travelMotorMin), pct: Math.round(summary.pctWalkOver60) }, lang)}
              </Fact>
            )}
            {summary.nearestHealthCentre && (
              <Fact source={a.srcFacilities}>
                {summary.nearestHealthCentre.from === "you"
                  ? fmtClient(a.nearestYou, { name: (lang === "km" && summary.nearestHealthCentre.nameKm) || summary.nearestHealthCentre.name, km: n(summary.nearestHealthCentre.km) }, lang)
                  : fmtClient(a.nearestCommune, { commune: summary.commune?.name ?? "", name: summary.nearestHealthCentre.name, km: n(summary.nearestHealthCentre.km) }, lang)}
              </Fact>
            )}
            {summary.nationalHypertensionPct && summary.nationalDiabetesPct && (
              <Fact source={a.srcWho}>
                {fmtClient(a.national, {
                  hyp: n(summary.nationalHypertensionPct.value), hypYear: summary.nationalHypertensionPct.year,
                  dm: n(summary.nationalDiabetesPct.value), dmYear: summary.nationalDiabetesPct.year,
                }, lang)}
              </Fact>
            )}
            {summary.vegPrice && (
              <Fact source={fmtClient(a.srcWfp, { from: lang === "km" ? toKhmerDigits(summary.vegPrice.from.slice(0, 7)) : summary.vegPrice.from.slice(0, 7), to: lang === "km" ? toKhmerDigits(summary.vegPrice.to.slice(0, 7)) : summary.vegPrice.to.slice(0, 7) }, lang)}>
                🥬 {fmtClient(a.veg, {
                  veg: a.veggies[summary.vegPrice.commodity as keyof typeof a.veggies] ?? summary.vegPrice.commodity,
                  price: lang === "km" ? toKhmerDigits(summary.vegPrice.khrPerKg.toLocaleString("en")) : summary.vegPrice.khrPerKg.toLocaleString("en"),
                  province: summary.province.name,
                }, lang)}
              </Fact>
            )}
          </ul>
          <p className="text-xs text-muted">ℹ️ {a.areaNote}</p>
          <Link href={`/${lang}/${summary.insightsLink}`} className="btn-ghost justify-start px-0 text-sm">
            {fmtClient(a.seeInsights, { district: summary.district.name }, lang)} →
          </Link>
        </>
      )}
    </section>
  );
}
