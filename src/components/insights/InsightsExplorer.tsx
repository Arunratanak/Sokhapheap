"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import type { Dictionary, Locale } from "@/lib/i18n";
import { fmtClient, toKhmerDigits } from "@/lib/client/util";
import { LAYERS, NO_DATA, quantileBreaks, colourFor, type AreaProps, type LayerDef, type LayerId } from "@/lib/insights/layers";
import type { FacilityItem } from "@/components/FacilityList";

// The map (Leaflet + boundaries) only loads when the user taps "Show map" — keeps the page fast on 3G.
const ChoroplethMap = dynamic(() => import("./ChoroplethMap"), {
  ssr: false,
  loading: () => <div className="h-[55vh] min-h-72 w-full animate-pulse rounded-2xl bg-black/5 lg:h-[34rem]" />,
});

type Level = "province" | "district" | "commune";
type T = Dictionary["insights"];
export interface RankRow {
  pcode: string;
  name: string;
  province: string;
  index: number;
  rank: number;
  drivers: string[];
  motor: number | null;
  per10k: number | null;
}

const num = (v: number, lang: Locale, digits = 1) => {
  const s = Number.isInteger(v) ? v.toLocaleString("en") : v.toFixed(digits);
  return lang === "km" ? toKhmerDigits(s) : s;
};

function formatValue(v: number | null, unit: LayerDef["unit"], t: T, lang: Locale): string {
  if (v === null) return t.noData;
  if (unit === "minutes") return fmtClient(t.panel.minutes, { n: num(Math.round(v * 10) / 10, lang) }, lang);
  if (unit === "percent") return fmtClient(t.panel.percent, { n: num(Math.round(v * 10) / 10, lang) }, lang);
  if (unit === "count") return num(Math.round(v), lang);
  if (unit === "per10k") return num(Math.round(v * 100) / 100, lang, 2);
  return num(Math.round(v * 10) / 10, lang);
}

export function InsightsExplorer({ lang, t, ranking }: { lang: Locale; t: Dictionary; ranking: RankRow[] }) {
  const ti = t.insights;
  const [level, setLevel] = useState<Level>("province");
  const [layerId, setLayerId] = useState<LayerId>("gap");
  const [data, setData] = useState<Partial<Record<Level, FeatureCollection<Geometry, AreaProps>>>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [showFac, setShowFac] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const layer = LAYERS.find((l) => l.id === layerId)!;
  const available = LAYERS.filter((l) => !(level === "commune" && l.notForCommune));
  const current = data[level];

  async function loadLevel(l: Level) {
    if (data[l]) return;
    const res = await fetch(`/api/insights/${l}`);
    const json = await res.json();
    setData((d) => ({ ...d, [l]: json }));
  }

  function toggleMap() {
    if (!showMap) void loadLevel(level);
    setShowMap((v) => !v);
  }

  function changeLevel(l: Level) {
    setLevel(l);
    setSelected(null);
    setFacilities([]);
    setShowFac(false);
    if (l === "commune" && LAYERS.find((x) => x.id === layerId)?.notForCommune) setLayerId("motor");
    if (showMap) void loadLevel(l);
  }

  async function select(pcode: string, at: Level = level) {
    if (at !== level) setLevel(at);
    await loadLevel(at);
    setSelected(pcode);
    setFacilities([]);
    setShowFac(false);
    requestAnimationFrame(() => panelRef.current?.focus());
  }

  const breaks = useMemo(() => (current ? quantileBreaks(current.features.map((f) => layer.get(f.properties)).filter((v): v is number => v !== null)) : []), [current, layer]);
  const area = current?.features.find((f) => f.properties.pcode === selected)?.properties ?? null;

  async function toggleFacilities() {
    if (showFac) return setShowFac(false);
    if (!area) return;
    const province = level === "province" ? area.name_en : area.province_name;
    const district = level === "district" ? area.name_en : level === "commune" ? area.district_name : undefined;
    const q = new URLSearchParams({ province: province ?? "", ...(district ? { district } : {}) });
    const res = await fetch(`/api/facilities/by-area?${q}`);
    const json = res.ok ? await res.json() : { facilities: [] };
    setFacilities(json.facilities ?? []);
    setShowFac(true);
  }

  const label = (p: AreaProps) => {
    const v = layer.get(p);
    return `${p.name_en}${p.province_name ? `, ${p.province_name}` : ""}: ${formatValue(v, layer.unit, ti, lang)}`;
  };

  // Legend rows: class ranges, darkest = worst.
  const legendRows = useMemo(() => {
    const edges = [Number.NEGATIVE_INFINITY, ...breaks, Number.POSITIVE_INFINITY];
    return edges.slice(0, -1).map((lo, i) => {
      const hi = edges[i + 1];
      const repr = Number.isFinite(lo) ? lo : (breaks[0] ?? 0) - 1;
      const colour = colourFor(repr, breaks, layer.lowIsWorse);
      const text = !Number.isFinite(lo)
        ? `< ${formatValue(hi, layer.unit, ti, lang)}`
        : !Number.isFinite(hi)
          ? `≥ ${formatValue(lo, layer.unit, ti, lang)}`
          : `${formatValue(lo, layer.unit, ti, lang)} – < ${formatValue(hi, layer.unit, ti, lang)}`;
      return { colour, text };
    });
  }, [breaks, layer, ti, lang]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <fieldset className="flex flex-col gap-1">
              <legend className="text-sm font-medium">{ti.levelLabel}</legend>
              <div className="flex overflow-hidden rounded-xl border-2 border-brand" role="group">
                {(["province", "district", "commune"] as Level[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={level === l}
                    onClick={() => changeLevel(l)}
                    className={`min-h-11 px-3 text-sm font-semibold ${level === l ? "bg-brand text-white" : "bg-surface text-brand-strong hover:bg-brand-soft"}`}
                  >
                    {ti.level[l]}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
              {ti.layerLabel}
              <select className="field w-full" value={layerId} onChange={(e) => setLayerId(e.target.value as LayerId)}>
                {available.map((l) => <option key={l.id} value={l.id}>{ti.layers[l.id]}</option>)}
              </select>
            </label>
          </div>
          {level === "commune" && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm">{ti.communeNote}</p>}

          <button type="button" className="btn-secondary" aria-expanded={showMap} aria-controls="insights-map" onClick={toggleMap}>
            🗺️ {showMap ? t.map.hideMap : t.map.showMap}
          </button>

          {showMap && (
          <div id="insights-map" className="flex flex-col gap-3">
          {current ? (
            <ChoroplethMap
              data={current}
              layer={layer}
              breaks={breaks}
              selected={selected}
              onSelect={(p) => select(p)}
              facilities={showFac ? facilities : []}
              ariaLabel={`${ti.title}: ${ti.layers[layer.id]}`}
              label={label}
            />
          ) : (
            <div className="flex h-[55vh] min-h-72 items-center justify-center rounded-2xl bg-black/5 lg:h-[34rem]" role="status">{ti.loadingMap}</div>
          )}

          <div aria-label={ti.legendTitle} className="rounded-xl border border-black/10 bg-surface p-3 text-sm">
            <p className="font-semibold">{ti.layers[layer.id]}</p>
            <p className="text-muted">{layer.lowIsWorse ? ti.legendBetter : layer.id === "gap" ? ti.legendWorse : ti.legendHigher} · {layer.source}</p>
            <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {legendRows.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span aria-hidden className="inline-block h-4 w-6 shrink-0 rounded border border-black/20" style={{ background: r.colour }} />
                  {r.text}
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-4 w-6 shrink-0 rounded border border-black/20" style={{ background: NO_DATA }} />
                {ti.noData}
              </li>
            </ul>
          </div>
          </div>
          )}
        </div>

        {/* Area panel: right column on desktop, bottom sheet on phones. */}
        <div
          ref={panelRef}
          tabIndex={-1}
          aria-live="polite"
          className={
            area
              ? "fixed inset-x-0 bottom-0 z-[1000] max-h-[65vh] overflow-y-auto rounded-t-2xl border-t border-black/10 bg-surface p-4 shadow-2xl lg:static lg:z-auto lg:max-h-none lg:rounded-2xl lg:border lg:shadow-none"
              : "hidden rounded-2xl border border-dashed border-black/20 p-4 text-sm text-muted lg:block"
          }
        >
          {area ? (
            <AreaPanel area={area} level={level} t={ti} lang={lang} onClose={() => setSelected(null)} showFac={showFac} onToggleFac={toggleFacilities} facCount={facilities.length} />
          ) : (
            <p>{ti.tapHint}</p>
          )}
        </div>
      </div>
      {!area && <p className="text-sm text-muted lg:hidden">{ti.tapHint}</p>}

      <RankingTable rows={ranking} t={ti} lang={lang} onView={(pcode) => select(pcode, "district")} />
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col border-b border-black/5 py-2 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-semibold">{value}{note && <span className="ml-1 text-xs font-normal text-muted">({note})</span>}</dd>
    </div>
  );
}

function AreaPanel({
  area, level, t, lang, onClose, showFac, onToggleFac, facCount,
}: { area: AreaProps; level: Level; t: T; lang: Locale; onClose: () => void; showFac: boolean; onToggleFac: () => void; facCount: number }) {
  const v = (x: number | null | undefined, unit: LayerDef["unit"]) => formatValue(x ?? null, unit, t, lang);
  const f = area.facilities;
  const sub = [area.district_name, area.province_name].filter(Boolean).join(", ");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{area.name_en}</h2>
          <p className="text-sm text-muted">{t.level[level]}{sub ? ` · ${sub}` : ""}</p>
        </div>
        <button type="button" onClick={onClose} className="btn-ghost min-h-10 shrink-0 text-sm">✕ {t.panel.close}</button>
      </div>

      {area.gap && (
        <section className="rounded-xl bg-brand-soft p-3">
          <p className="text-sm font-medium">{t.panel.gapIndex}</p>
          <p className="text-3xl font-bold">
            {num(area.gap.index, lang)} <span className="text-base font-normal">/ {num(100, lang)}</span>
          </p>
          <p className="text-sm">{fmtClient(t.panel.rank, { rank: num(area.gap.rank, lang), of: num(area.gap.of, lang) }, lang)}</p>
          <p className="mt-2 text-sm font-medium">{t.panel.drivers}</p>
          {area.gap.drivers.length ? (
            <ul className="text-sm">
              {area.gap.drivers.map((d) => (
                <li key={d}>• {t.components[d as keyof T["components"]]} ({num(area.gap!.components[d] ?? 0, lang)}/{num(100, lang)})</li>
              ))}
            </ul>
          ) : <p className="text-sm">{t.panel.noDrivers}</p>}
        </section>
      )}

      <section>
        <h3 className="font-semibold">{t.panel.indicators}</h3>
        <dl>
          <Row label={t.panel.population} value={v(area.population, "count")} note="WorldPop 2025" />
          {area.population_official_2024 != null && <Row label={t.panel.officialPop} value={v(area.population_official_2024, "count")} note="COD-PS 2024" />}
          <Row label={t.panel.adults} value={v(area.adults_20plus_est, "count")} note="WorldPop 2025 · COD-PS 2024" />
          <Row label={t.panel.motor} value={v(area.travel_motor_mean_min, "minutes")} note="MAP 2019" />
          <Row label={t.panel.walk} value={v(area.travel_walk_mean_min, "minutes")} note="MAP 2019" />
          <Row label={t.panel.walk60} value={v(area.pct_walk_over_60_min, "percent")} note="MAP 2019" />
          <Row label={t.panel.motor30} value={v(area.pct_motor_over_30_min, "percent")} note="MAP 2019" />
          {f && (
            <Row
              label={t.panel.facilities}
              value={`${v(f.total, "count")} — ${fmtClient(t.panel.breakdown, { h: num(f.hospital, lang), hc: num(f.health_centre, lang), hp: num(f.health_post, lang), c: num(f.clinic, lang) }, lang)}`}
              note="MoH 2010 · OSM 2026"
            />
          )}
          <Row label={t.panel.per10k} value={v(area.facilities_per_10k, "per10k")} note="MoH · OSM · WorldPop" />
          {area.nearest_hospital?.name && (
            <Row label={t.panel.nearestHospital} value={fmtClient(t.panel.kmAway, { name: area.nearest_hospital.name, km: num(area.nearest_hospital.km ?? 0, lang) }, lang)} note="MoH · OSM" />
          )}
          {area.nearest_health_centre?.name && (
            <Row label={t.panel.nearestHc} value={fmtClient(t.panel.kmAway, { name: area.nearest_health_centre.name, km: num(area.nearest_health_centre.km ?? 0, lang) }, lang)} note="MoH · OSM" />
          )}
        </dl>
      </section>

      {area.dhs && (
        <section>
          <h3 className="font-semibold">{t.panel.survey}</h3>
          <dl>
            {(["women_owt", "men_smoke", "women_smoke", "distance", "poverty"] as LayerId[]).map((id) => {
              const def = LAYERS.find((l) => l.id === id)!;
              return <Row key={id} label={t.layers[id]} value={v(def.get(area), "percent")} note="DHS 2021–22" />;
            })}
          </dl>
        </section>
      )}

      <button type="button" className="btn-secondary min-h-12 text-base" onClick={onToggleFac} aria-pressed={showFac}>
        🏥 {showFac ? `${t.panel.hideFacilities} (${num(facCount, lang)})` : t.panel.showFacilities}
      </button>
    </div>
  );
}

type SortKey = "rank" | "name" | "province" | "motor" | "per10k";

function RankingTable({ rows, t, lang, onView }: { rows: RankRow[]; t: T; lang: Locale; onView: (pcode: string) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "rank", asc: true });
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle ? rows.filter((r) => `${r.name} ${r.province}`.toLowerCase().includes(needle)) : rows.slice(0, 20);
    const val = (r: RankRow) => (sort.key === "name" ? r.name : sort.key === "province" ? r.province : sort.key === "motor" ? r.motor ?? -1 : sort.key === "per10k" ? r.per10k ?? -1 : r.rank);
    return [...filtered].sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number);
      return sort.asc ? c : -c;
    });
  }, [rows, q, sort]);

  const th = (key: SortKey, label: string, className = "") => (
    <th scope="col" className={`px-2 py-2 text-left ${className}`} aria-sort={sort.key === key ? (sort.asc ? "ascending" : "descending") : "none"}>
      <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }))} aria-label={fmtClient(t.ranking.sortBy, { col: label }, lang)}>
        {label} {sort.key === key ? (sort.asc ? "▲" : "▼") : ""}
      </button>
    </th>
  );

  return (
    <section aria-labelledby="ranking-title" className="flex min-w-0 flex-col gap-3">
      <div>
        <h2 id="ranking-title" className="text-xl font-bold">{t.ranking.title}</h2>
        <p className="text-sm text-muted">{t.ranking.subtitle}</p>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t.ranking.search}
        <input type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="relative w-full max-w-full overflow-x-auto rounded-xl border border-black/10">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-brand-soft">
            <tr>
              {th("rank", t.ranking.rank)}
              {th("name", t.ranking.district)}
              {th("province", t.ranking.province)}
              <th scope="col" className="px-2 py-2 text-left font-semibold">{t.ranking.drivers}</th>
              {th("motor", t.ranking.travel, "text-right")}
              {th("per10k", t.ranking.per10k, "text-right")}
              <th scope="col" className="px-2 py-2"><span className="sr-only">{t.ranking.view}</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.pcode} className="border-t border-black/5">
                <td className="px-2 py-2 font-semibold">
                  {num(r.rank, lang)}
                  <span className="ml-2 inline-block rounded bg-brand-soft px-1.5 text-xs text-brand-strong">
                    {num(r.index, lang)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2 [overflow-wrap:normal]">{r.name}</td>
                <td className="whitespace-nowrap px-2 py-2 [overflow-wrap:normal]">{r.province}</td>
                <td className="px-2 py-2">{r.drivers.map((d) => t.components[d as keyof T["components"]]).join(", ")}</td>
                <td className="px-2 py-2 text-right">{r.motor === null ? "—" : num(r.motor, lang)}</td>
                <td className="px-2 py-2 text-right">{r.per10k === null ? "—" : num(r.per10k, lang, 2)}</td>
                <td className="px-2 py-2 text-right">
                  <button type="button" className="btn-ghost min-h-10 text-sm" onClick={() => onView(r.pcode)}>{t.ranking.view} <span className="sr-only">{r.name}</span></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <p className="p-3 text-sm">{t.ranking.noResults}</p>}
      </div>
    </section>
  );
}
