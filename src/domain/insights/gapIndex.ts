/**
 * Screening Gap Index — pure computation (see gapIndexConfig.ts for the formula and weights).
 * Used by scripts/data/opendata/gap_index.ts to precompute data/clean/gap_index_*.json.
 */
import type { ComponentDef, ComponentId } from "./gapIndexConfig";

export type AreaRecord = Record<string, unknown> & { pcode: string; name_en: string };

export function getField(a: Record<string, unknown>, field: string): number | null {
  let v: unknown = a;
  for (const k of field.split(".")) v = v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Linear-interpolated percentile (p in 0–1) of a non-empty array. */
export function percentile(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  const i = p * (s.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

/**
 * Min-max scaling to 0–1 after capping at the [clip[0], clip[1]] percentiles.
 * If all values are equal (no spread), every area gets 0 — the indicator cannot rank them.
 */
export function makeScaler(values: number[], clip: [number, number], invert = false) {
  const lo = percentile(values, clip[0]);
  const hi = percentile(values, clip[1]);
  return (x: number) => {
    const s = hi > lo ? Math.min(1, Math.max(0, (x - lo) / (hi - lo))) : 0;
    return invert ? (hi > lo ? 1 - s : 0) : s;
  };
}

export interface GapResult {
  pcode: string;
  name_en: string;
  index: number; // 0–100, 1 decimal
  rank: number; // 1 = biggest gap
  components: Record<ComponentId, number | null>; // 0–100, 1 decimal
  drivers: ComponentId[]; // top 3 by weight × score (score > 0)
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function computeGapIndex(areas: AreaRecord[], components: ComponentDef[], clip: [number, number]): GapResult[] {
  // Build one scaler per indicator from all areas' values.
  const scalers = new Map<string, (x: number) => number>();
  for (const c of components) {
    for (const ind of c.indicators) {
      const vals = areas.map((a) => getField(a, ind.field)).filter((v): v is number => v !== null);
      scalers.set(ind.field, vals.length ? makeScaler(vals, clip, ind.direction === "lower_is_worse") : () => 0);
    }
  }

  const rows = areas.map((a) => {
    const comp = {} as Record<ComponentId, number | null>;
    let wSum = 0, total = 0;
    const contrib: [ComponentId, number][] = [];
    for (const c of components) {
      const scores = c.indicators
        .map((ind) => {
          const v = getField(a, ind.field);
          return v === null ? null : scalers.get(ind.field)!(v);
        })
        .filter((s): s is number => s !== null);
      if (!scores.length || c.weight <= 0) {
        comp[c.id] = scores.length ? r1(100 * (scores.reduce((x, y) => x + y, 0) / scores.length)) : null;
        continue;
      }
      const score = scores.reduce((x, y) => x + y, 0) / scores.length;
      comp[c.id] = r1(100 * score);
      wSum += c.weight;
      total += c.weight * score;
      contrib.push([c.id, c.weight * score]);
    }
    const drivers = contrib
      .filter(([, v]) => v > 0)
      .sort((x, y) => y[1] - x[1] || components.findIndex((c) => c.id === x[0]) - components.findIndex((c) => c.id === y[0]))
      .slice(0, 3)
      .map(([id]) => id);
    return { pcode: a.pcode, name_en: a.name_en, index: wSum ? r1((100 * total) / wSum) : 0, rank: 0, components: comp, drivers };
  });

  rows.sort((x, y) => y.index - x.index || x.pcode.localeCompare(y.pcode));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** Spearman rank correlation between two rankings of the same areas (by pcode). */
export function spearman(a: GapResult[], b: GapResult[]): number {
  const rb = new Map(b.map((r) => [r.pcode, r.rank]));
  const n = a.length;
  const d2 = a.reduce((s, r) => s + (r.rank - (rb.get(r.pcode) ?? r.rank)) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}
