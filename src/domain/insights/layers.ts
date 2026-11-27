/**
 * Map layers for the Insights page (client-safe). Each layer reads one value from an area's properties.
 * Colour scale: 5 quantile classes, ColorBrewer "YlOrRd" (sequential, colour-blind safe); darker = worse.
 */
export type LayerId =
  | "gap" | "motor" | "walk" | "walk60" | "per10k" | "population"
  | "women_owt" | "men_smoke" | "women_smoke" | "distance" | "poverty";

export type Unit = "index" | "minutes" | "percent" | "count" | "per10k";

export interface LayerDef {
  id: LayerId;
  unit: Unit;
  /** true when a LOW value is the bad end (facilities per 10k) — colours are reversed. */
  lowIsWorse?: boolean;
  /** Survey/index layers are not available for communes. */
  notForCommune?: boolean;
  get: (p: AreaProps) => number | null;
  /** Dataset + year shown in the legend. */
  source: string;
}

export interface AreaProps {
  pcode: string;
  name_en: string;
  province_name?: string;
  district_name?: string;
  population?: number;
  adults_20plus_est?: number | null;
  travel_motor_mean_min?: number | null;
  travel_walk_mean_min?: number | null;
  pct_walk_over_60_min?: number | null;
  pct_motor_over_30_min?: number | null;
  facilities_per_10k?: number | null;
  facilities?: { hospital: number; health_centre: number; health_post: number; clinic: number; other: number; total: number };
  dhs?: Record<string, number | null>;
  population_official_2024?: number | null;
  nearest_hospital?: { km: number | null; name: string | null };
  nearest_health_centre?: { km: number | null; name: string | null };
  gap?: { index: number; rank: number; of: number; drivers: string[]; components: Record<string, number | null> } | null;
}

const dhs = (k: string) => (p: AreaProps) => p.dhs?.[k] ?? null;

export const LAYERS: LayerDef[] = [
  { id: "gap", unit: "index", notForCommune: true, get: (p) => p.gap?.index ?? null, source: "SokhaPheap, 2026" },
  { id: "motor", unit: "minutes", get: (p) => p.travel_motor_mean_min ?? null, source: "Malaria Atlas Project 2019 · WorldPop 2025" },
  { id: "walk", unit: "minutes", get: (p) => p.travel_walk_mean_min ?? null, source: "Malaria Atlas Project 2019 · WorldPop 2025" },
  { id: "walk60", unit: "percent", get: (p) => p.pct_walk_over_60_min ?? null, source: "Malaria Atlas Project 2019 · WorldPop 2025" },
  { id: "per10k", unit: "per10k", lowIsWorse: true, get: (p) => p.facilities_per_10k ?? null, source: "MoH 2010 · OpenStreetMap 2026 · WorldPop 2025" },
  { id: "population", unit: "count", get: (p) => p.population ?? null, source: "WorldPop 2025" },
  { id: "women_owt", unit: "percent", notForCommune: true, get: dhs("women_overweight_or_obese_pct"), source: "DHS 2021–22" },
  { id: "men_smoke", unit: "percent", notForCommune: true, get: dhs("men_smoke_tobacco_pct"), source: "DHS 2021–22" },
  { id: "women_smoke", unit: "percent", notForCommune: true, get: dhs("women_smoke_tobacco_pct"), source: "DHS 2021–22" },
  { id: "distance", unit: "percent", notForCommune: true, get: dhs("women_distance_is_problem_pct"), source: "DHS 2021–22" },
  { id: "poverty", unit: "percent", notForCommune: true, get: dhs("population_lowest_wealth_quintile_pct"), source: "DHS 2021–22" },
];

/** 5 classes (light → dark). */
// Sequential gold → brown (DESIGN.md §10: calm, no alarm-red; darkest = worst). Readable on map tiles and on paper.
export const PALETTE = ["#f3e8c8", "#e0c47f", "#c9a24a", "#94702a", "#5c4317"] as const;
export const NO_DATA = "#d6d0c4";

/** Quantile class breaks: returns the 4 inner thresholds for 5 classes (deduplicated). */
export function quantileBreaks(values: number[], classes = 5): number[] {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!s.length) return [];
  const out: number[] = [];
  for (let i = 1; i < classes; i++) {
    const v = s[Math.min(s.length - 1, Math.floor((i * s.length) / classes))];
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** Class index 0..breaks.length for a value (value < breaks[0] → 0). */
export function classOf(v: number, breaks: number[]): number {
  let i = 0;
  while (i < breaks.length && v >= breaks[i]) i++;
  return i;
}

/** Colour for a value: darker = worse (reversed for lowIsWorse layers). */
export function colourFor(v: number | null, breaks: number[], lowIsWorse = false): string {
  if (v === null) return NO_DATA;
  const n = breaks.length + 1;
  const c = classOf(v, breaks);
  const idx = lowIsWorse ? n - 1 - c : c;
  // Spread the used classes over the 5-colour palette when breaks collapsed.
  return PALETTE[Math.round((idx * (PALETTE.length - 1)) / Math.max(1, n - 1))];
}
