import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { ComponentId } from "../../domain/insights/gapIndexConfig";

/**
 * Reads the precomputed open-data outputs in data/clean (built on a laptop by `npm run data:build`).
 * Nothing here does heavy processing; results are cached in memory after the first read.
 */
const CLEAN = path.join(process.cwd(), "data/clean");
const cache = new Map<string, unknown>();
function readJson<T>(file: string): T {
  if (!cache.has(file)) cache.set(file, JSON.parse(fs.readFileSync(path.join(CLEAN, file), "utf8")));
  return cache.get(file) as T;
}

export type Level = "province" | "district" | "commune";
export const LEVELS: Level[] = ["province", "district", "commune"];

type Counts = { hospital: number; health_centre: number; health_post: number; clinic: number; other: number; total: number };
export interface AreaJson {
  pcode: string;
  name_en: string;
  province_pcode?: string;
  district_pcode?: string;
  population: number;
  adults_20plus_est: number | null;
  travel_motor_mean_min: number | null;
  travel_walk_mean_min: number | null;
  pct_walk_over_60_min: number | null;
  pct_motor_over_30_min: number | null;
  facilities: Counts;
  facilities_per_10k: number | null;
  dhs?: Record<string, number | null>;
  population_official_2024?: number | null;
  nearest_hospital?: { km: number | null; name: string | null };
  nearest_health_centre?: { km: number | null; name: string | null };
}
export interface GapJson {
  pcode: string;
  name_en: string;
  index: number;
  rank: number;
  components: Record<ComponentId, number | null>;
  drivers: ComponentId[];
  province_pcode?: string;
  province_name?: string;
}

export const areas = (level: Level) => readJson<{ areas: AreaJson[] }>(`areas_${level}.json`).areas;
export const gap = (level: "province" | "district") => readJson<{ areas: GapJson[] }>(`gap_index_${level}.json`).areas;

/** Province names by P-code. */
export function provinceNames(): Map<string, string> {
  return new Map(areas("province").map((p) => [p.pcode, p.name_en]));
}

/** One merged record per area: indicators + gap index (if any) — what the map panel shows. */
export function mergedAreas(level: Level) {
  const g = level === "commune" ? new Map<string, GapJson>() : new Map(gap(level).map((x) => [x.pcode, x]));
  const provs = provinceNames();
  const districtNames = level === "commune" ? new Map(areas("district").map((d) => [d.pcode, d.name_en])) : null;
  return areas(level).map((a) => {
    const x = g.get(a.pcode);
    return {
      ...a,
      province_name: a.province_pcode ? provs.get(a.province_pcode) : undefined,
      district_name: a.district_pcode ? districtNames?.get(a.district_pcode) : undefined,
      gap: x ? { index: x.index, rank: x.rank, components: x.components, drivers: x.drivers, of: g.size } : null,
    };
  });
}
export type MergedArea = ReturnType<typeof mergedAreas>[number];

/** Map GeoJSON for a level: simplified boundaries with merged indicators as properties. */
export function mapGeoJson(level: Level) {
  const key = `geo:${level}`;
  if (cache.has(key)) return cache.get(key) as object;
  const gj = readJson<{ features: { type: string; geometry: unknown; properties: Record<string, string> }[] }>(`boundaries_${level}.geojson`);
  const pk = { province: "adm1_pcode", district: "adm2_pcode", commune: "adm3_pcode" }[level];
  const byPcode = new Map(mergedAreas(level).map((a) => [a.pcode, a]));
  const out = {
    type: "FeatureCollection",
    features: gj.features.map((f) => ({ type: "Feature", geometry: f.geometry, properties: byPcode.get(f.properties[pk]) ?? { pcode: f.properties[pk] } })),
  };
  cache.set(key, out);
  return out;
}

export interface NationalIndicator { value: number | null; year: number; low?: number | null; high?: number | null; source: string; label?: string }
export function nationalContext() {
  return readJson<{ indicators: Record<string, NationalIndicator | null>; dhs_national_2021: Record<string, number | null> }>("national_context.json");
}

export interface ManifestDataset {
  id: string; name: string; publisher: string; url: string; licence: string; licence_url: string | null; data_year: string; used_for: string;
}
export function manifest(): ManifestDataset[] {
  const m = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/manifest.json"), "utf8")) as { datasets: ManifestDataset[] };
  return m.datasets;
}

/** Real numbers for the home page (facility, area and dataset counts; WHO / World Bank indicators). */
export function homeStats() {
  const count = (file: string) => readJson<{ areas: unknown[] }>(file).areas.length;
  const ind = nationalContext().indicators;
  const pick = (k: string) => (ind[k]?.value != null ? { value: ind[k]!.value as number, year: ind[k]!.year, source: ind[k]!.source } : null);
  return {
    facilities: readJson<{ features: unknown[] }>("facilities.geojson").features.length,
    provinces: count("areas_province.json"),
    communes: count("areas_commune.json"),
    datasets: manifest().length,
    htnDiagnosed: pick("hypertension_diagnosed_pct"),
    htnControlled: pick("hypertension_controlled_pct"),
    outOfPocket: pick("out_of_pocket_share_of_health_spending_pct"),
  };
}

/** Files offered for download (CC BY 4.0) and their content types. */
export const DOWNLOADS = {
  "areas_district.csv": "text/csv; charset=utf-8",
  "gap_index.geojson": "application/geo+json",
} as const;
export type DownloadFile = keyof typeof DOWNLOADS;
export function readDownload(file: DownloadFile): string {
  return fs.readFileSync(path.join(CLEAN, file), "utf8");
}
