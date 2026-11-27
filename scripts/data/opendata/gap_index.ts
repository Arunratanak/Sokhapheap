/**
 * Screening Gap Index (Phase 3). Reads data/clean/areas_{district,province}.json and writes:
 *   data/clean/gap_index_district.json · gap_index_province.json
 *   data/clean/gap_index.geojson (district boundaries + index, for download / maps)
 *   data/clean/gap_index_sensitivity.md
 * Deterministic. Run: npm run data:gap-index (also part of npm run data:build).
 */
import fs from "node:fs";
import path from "node:path";
import { computeGapIndex, getField, spearman, type AreaRecord, type GapResult } from "../../../src/domain/insights/gapIndex";
import { GAP_INDEX_CLIP, GAP_INDEX_COMPONENTS, type ComponentDef } from "../../../src/domain/insights/gapIndexConfig";
import { stableStringify } from "./lib";

const CLEAN = path.resolve(__dirname, "../../../data/clean");
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(CLEAN, f), "utf8")).areas as AreaRecord[];
const districts = load("areas_district.json");
const provinces = load("areas_province.json");
const provName = new Map(provinces.map((p) => [p.pcode, p.name_en]));

const meta = {
  description: "Screening Gap Index: a planning tool showing where NCD screening could help most. It is not a measure of anyone's health.",
  formula: "Indicators capped at the 5th–95th percentile and min-max scaled to 0–1 (facilities per 10,000 inverted); component = mean of its indicators; index = 100 × weighted mean of components. Rank 1 = biggest gap.",
  clip_percentiles: GAP_INDEX_CLIP,
  components: GAP_INDEX_COMPONENTS.map((c) => ({
    id: c.id, label: c.label, weight: c.weight,
    indicators: c.indicators.map((i) => ({ field: i.field, label: i.label, direction: i.direction, source: i.source, year: i.year, level: i.level })),
  })),
  licence_of_this_file: "CC BY 4.0",
  citation: "SokhaPheap Screening Gap Index (2026), from COD-AB, WorldPop, Malaria Atlas Project, MoH, OpenStreetMap and DHS 2021–22 — see data/manifest.json",
};

const base = computeGapIndex(districts, GAP_INDEX_COMPONENTS, GAP_INDEX_CLIP);
const baseProv = computeGapIndex(provinces, GAP_INDEX_COMPONENTS, GAP_INDEX_CLIP);
const withProvince = (r: GapResult) => {
  const d = districts.find((x) => x.pcode === r.pcode)!;
  return { ...r, province_pcode: d.province_pcode, province_name: provName.get(String(d.province_pcode)) };
};

fs.writeFileSync(path.join(CLEAN, "gap_index_district.json"), stableStringify({ ...meta, level: "district", areas: base.map(withProvince) }, 1));
fs.writeFileSync(path.join(CLEAN, "gap_index_province.json"), stableStringify({ ...meta, level: "province", areas: baseProv }, 1));

// GeoJSON for download: simplified district boundaries + index fields.
const gj = JSON.parse(fs.readFileSync(path.join(CLEAN, "boundaries_district.geojson"), "utf8"));
const byPcode = new Map(base.map((r) => [r.pcode, r]));
gj.features = gj.features
  .map((f: { properties: Record<string, unknown> }) => {
    const r = byPcode.get(String(f.properties.adm2_pcode));
    return {
      ...f,
      properties: {
        adm2_pcode: f.properties.adm2_pcode, adm2_name: f.properties.adm2_name, adm1_pcode: f.properties.adm1_pcode,
        gap_index: r?.index ?? null, gap_rank: r?.rank ?? null, drivers: r?.drivers.join(",") ?? null,
        ...Object.fromEntries(Object.entries(r?.components ?? {}).map(([k, v]) => [`score_${k}`, v])),
      },
    };
  })
  .sort((a: { properties: { adm2_pcode: string } }, b: { properties: { adm2_pcode: string } }) => a.properties.adm2_pcode.localeCompare(b.properties.adm2_pcode));
gj.name = "gap_index_district";
fs.writeFileSync(path.join(CLEAN, "gap_index.geojson"), stableStringify({ ...gj, licence: "CC BY 4.0", citation: meta.citation }));

// CSV for download: one row per district with every indicator + the gap index (CC BY 4.0).
const csvCols: [string, (d: AreaRecord, g: GapResult) => unknown][] = [
  ["pcode", (d) => d.pcode], ["district", (d) => d.name_en], ["province_pcode", (d) => d.province_pcode],
  ["province", (d) => provName.get(String(d.province_pcode))],
  ["population_2025", (d) => d.population], ["adults_20plus_est", (d) => d.adults_20plus_est],
  ["travel_motor_mean_min_2019", (d) => d.travel_motor_mean_min], ["travel_walk_mean_min_2019", (d) => d.travel_walk_mean_min],
  ["pct_walk_over_60_min_2019", (d) => d.pct_walk_over_60_min], ["pct_motor_over_30_min_2019", (d) => d.pct_motor_over_30_min],
  ["facilities_total", (d) => (d.facilities as Record<string, number>).total],
  ["hospitals", (d) => (d.facilities as Record<string, number>).hospital],
  ["health_centres", (d) => (d.facilities as Record<string, number>).health_centre],
  ["health_posts", (d) => (d.facilities as Record<string, number>).health_post],
  ["clinics", (d) => (d.facilities as Record<string, number>).clinic],
  ["facilities_per_10k", (d) => d.facilities_per_10k],
  ...Object.keys((districts[0].dhs as Record<string, number>) ?? {}).sort().map(
    (k) => [`dhs2021_province_${k}`, (d: AreaRecord) => (d.dhs as Record<string, number | null>)[k]] as [string, (d: AreaRecord) => unknown],
  ),
  ["gap_index", (_d, g) => g.index], ["gap_rank", (_d, g) => g.rank], ["gap_drivers", (_d, g) => g.drivers.join(" ")],
  ...GAP_INDEX_COMPONENTS.map((c) => [`gap_score_${c.id}`, (_d: AreaRecord, g: GapResult) => g.components[c.id]] as [string, (d: AreaRecord, g: GapResult) => unknown]),
];
const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [
  csvCols.map(([h]) => h).join(","),
  ...[...districts].sort((a, b) => a.pcode.localeCompare(b.pcode)).map((d) => {
    const g = byPcode.get(d.pcode)!;
    return csvCols.map(([, f]) => esc(f(d, g))).join(",");
  }),
].join("\n") + "\n";
fs.writeFileSync(path.join(CLEAN, "areas_district.csv"), csv);

// ---------------------------------------------------------------- sensitivity
const top = (r: GapResult[], n = 10) => r.slice(0, n).map((x) => x.pcode);
const baseTop = top(base);
type Variant = { name: string; comps: ComponentDef[]; clip: [number, number] };
const reweight = (id: string, w: number) => GAP_INDEX_COMPONENTS.map((c) => (c.id === id ? { ...c, weight: w } : c));
const variants: Variant[] = [
  ...GAP_INDEX_COMPONENTS.map((c) => ({ name: `without ${c.label.en.toLowerCase()} (${c.id})`, comps: reweight(c.id, 0), clip: GAP_INDEX_CLIP })),
  ...GAP_INDEX_COMPONENTS.map((c) => ({ name: `${c.id} weight +50%`, comps: reweight(c.id, c.weight * 1.5), clip: GAP_INDEX_CLIP })),
  ...GAP_INDEX_COMPONENTS.map((c) => ({ name: `${c.id} weight −50%`, comps: reweight(c.id, c.weight * 0.5), clip: GAP_INDEX_CLIP })),
  { name: "plain min-max (no percentile capping)", comps: GAP_INDEX_COMPONENTS, clip: [0, 1] },
];
const rows = variants.map((v) => {
  const r = computeGapIndex(districts, v.comps, v.clip);
  const t = top(r);
  const overlap = t.filter((p) => baseTop.includes(p)).length;
  const rankOf = new Map(r.map((x) => [x.pcode, x.rank]));
  const maxShift = Math.max(...baseTop.map((p) => Math.abs((rankOf.get(p) ?? 0) - base.find((x) => x.pcode === p)!.rank)));
  return { name: v.name, overlap, rho: spearman(base, r), maxShift, entered: t.filter((p) => !baseTop.includes(p)) };
});

const name = (pc: string) => {
  const d = districts.find((x) => x.pcode === pc)!;
  return `${d.name_en} (${provName.get(String(d.province_pcode))})`;
};
const overlaps = rows.map((r) => r.overlap).sort((a, b) => a - b);
const medianOverlap = overlaps[Math.floor(overlaps.length / 2)];
const minOverlap = overlaps[0];
const stability = medianOverlap >= 8 && minOverlap >= 5 ? "stable" : medianOverlap >= 6 ? "moderately stable" : "UNSTABLE";

// How often each district appears in the top 10 across all variants (robust core).
const count = new Map<string, number>();
for (const v of variants) for (const p of top(computeGapIndex(districts, v.comps, v.clip))) count.set(p, (count.get(p) ?? 0) + 1);
const robust = [...count].filter(([, n]) => n === variants.length).map(([p]) => p);

const md: string[] = [];
md.push("# Screening Gap Index: sensitivity report", "");
md.push(`Generated by \`npm run data:gap-index\`. Baseline: ${GAP_INDEX_COMPONENTS.length} components with equal weights, indicators capped at the ${GAP_INDEX_CLIP[0] * 100}th–${GAP_INDEX_CLIP[1] * 100}th percentile, ${districts.length} districts.`, "");
md.push(`**Verdict: the district top 10 is ${stability}.** Median top-10 overlap across ${variants.length} variants: ${medianOverlap}/10, worst case: ${minOverlap}/10.`, "");
md.push(`Districts in the top 10 in **every** variant (${robust.length}): ${robust.map(name).join("; ") || "none"}.`, "");
md.push("| Variant | Top-10 overlap with baseline | Spearman ρ (all districts) | Max rank shift of a baseline top-10 district | New in top 10 |");
md.push("|---|---:|---:|---:|---|");
for (const r of rows) md.push(`| ${r.name} | ${r.overlap}/10 | ${r.rho.toFixed(3)} | ${r.maxShift} | ${r.entered.map(name).join("; ") || "—"} |`);
md.push("", "## Baseline top 10 districts", "");
md.push("| Rank | District | Index | Top drivers |", "|---:|---|---:|---|");
for (const r of base.slice(0, 10)) md.push(`| ${r.rank} | ${name(r.pcode)} | ${r.index} | ${r.drivers.join(", ")} |`);
md.push("", "## How to read this", "");
md.push("- **Overlap** counts how many of the baseline top-10 districts stay in the top 10 when the method changes.");
md.push("- **Spearman ρ** compares the full ranking of all districts (1 = identical order).");
md.push("- Removing a component tests whether one data source drives the result; ±50% weights test the arbitrary equal-weight choice.");
md.push("- Risk, poverty and the distance-problem indicator are province values (DHS), so districts in the same province share them; travel time, facilities and population vary by district.");
fs.writeFileSync(path.join(CLEAN, "gap_index_sensitivity.md"), md.join("\n") + "\n");

// ---------------------------------------------------------------- console summary
const show = (r: GapResult) => {
  const d = districts.find((x) => x.pcode === r.pcode)!;
  return `${String(r.rank).padStart(3)}. ${name(r.pcode).padEnd(38)} ${String(r.index).padStart(5)} | drivers: ${r.drivers.join(", ").padEnd(28)} | adults ${getField(d, "adults_20plus_est")} · motor ${getField(d, "travel_motor_mean_min")} min · walk>60 ${getField(d, "pct_walk_over_60_min")}% · fac/10k ${getField(d, "facilities_per_10k")}`;
};
console.log("TOP 10 districts\n" + base.slice(0, 10).map(show).join("\n"));
console.log("\nBOTTOM 10 districts\n" + base.slice(-10).map(show).join("\n"));
console.log(`\nSensitivity: ${stability} (median overlap ${medianOverlap}/10, worst ${minOverlap}/10); always top 10: ${robust.length}`);
for (const r of rows) console.log(`  ${r.name.padEnd(48)} overlap ${r.overlap}/10  rho ${r.rho.toFixed(3)}  max shift ${r.maxShift}`);
console.log("\nProvinces (top 5 / bottom 5): " + baseProv.slice(0, 5).map((p) => `${p.name_en} ${p.index}`).join(", ") + " … " + baseProv.slice(-5).map((p) => `${p.name_en} ${p.index}`).join(", "));
