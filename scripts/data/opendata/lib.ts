/**
 * Pure helpers for the open-data pipeline (unit-tested in lib.test.ts).
 */

export type Ring = number[][]; // [[lng, lat], ...]
export type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };

/** A north-up raster grid: origin = top-left corner, res in degrees. */
export interface Grid {
  ox: number; // west edge (lng)
  oy: number; // north edge (lat)
  res: number;
  width: number;
  height: number;
}

export function ringsOf(g: Geometry): Ring[] {
  return g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
}

export function bboxOf(rings: Ring[]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) for (const [x, y] of r) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/**
 * Scanline rasterisation: calls `fill(row, col)` for every grid cell whose CENTRE lies inside the
 * geometry (even-odd rule, so holes and multipolygons work). Returns the number of cells filled.
 */
export function rasterize(rings: Ring[], grid: Grid, fill: (row: number, col: number) => void): number {
  const [minX, minY, maxX, maxY] = bboxOf(rings);
  const r0 = Math.max(0, Math.floor((grid.oy - maxY) / grid.res));
  const r1 = Math.min(grid.height - 1, Math.floor((grid.oy - minY) / grid.res));
  let n = 0;
  const xs: number[] = [];
  for (let r = r0; r <= r1; r++) {
    const y = grid.oy - (r + 0.5) * grid.res;
    xs.length = 0;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - grid.ox) / grid.res - 0.5));
      const c1 = Math.min(grid.width - 1, Math.floor((xs[k + 1] - grid.ox) / grid.res - 0.5));
      for (let c = c0; c <= c1; c++) {
        fill(r, c);
        n++;
      }
    }
  }
  void minX; void maxX;
  return n;
}

/** Even-odd point-in-polygon test. */
export function pointInRings(x: number, y: number, rings: Ring[]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Index of the grid cell containing (lng, lat), or -1 if outside. */
export function cellIndex(grid: Grid, lng: number, lat: number): number {
  const c = Math.floor((lng - grid.ox) / grid.res);
  const r = Math.floor((grid.oy - lat) / grid.res);
  if (c < 0 || r < 0 || c >= grid.width || r >= grid.height) return -1;
  return r * grid.width + c;
}

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Round to `d` decimals; null stays null. Avoids "-0". */
export function round(v: number | null | undefined, d = 1): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  const f = 10 ** d;
  const r = Math.round(v * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

/** Population-weighted accumulator for one area. */
export interface Acc {
  pop: number;
  popMotor: number; // population with a valid motorised travel time
  wMotor: number; // Σ pop × minutes
  popWalk: number;
  wWalk: number;
  popWalkOver60: number;
  popMotorOver30: number;
  cells: number;
}
export const emptyAcc = (): Acc => ({ pop: 0, popMotor: 0, wMotor: 0, popWalk: 0, wWalk: 0, popWalkOver60: 0, popMotorOver30: 0, cells: 0 });

export function addCell(a: Acc, pop: number, motor: number | null, walk: number | null) {
  a.pop += pop;
  a.cells++;
  if (motor !== null) {
    a.popMotor += pop;
    a.wMotor += pop * motor;
    if (motor > 30) a.popMotorOver30 += pop;
  }
  if (walk !== null) {
    a.popWalk += pop;
    a.wWalk += pop * walk;
    if (walk > 60) a.popWalkOver60 += pop;
  }
}

export function mergeAcc(into: Acc, a: Acc) {
  for (const k of Object.keys(into) as (keyof Acc)[]) into[k] += a[k];
}

export function summarise(a: Acc) {
  return {
    population: Math.round(a.pop),
    travel_motor_mean_min: a.popMotor > 0 ? round(a.wMotor / a.popMotor, 1) : null,
    travel_walk_mean_min: a.popWalk > 0 ? round(a.wWalk / a.popWalk, 1) : null,
    pct_walk_over_60_min: a.popWalk > 0 ? round((100 * a.popWalkOver60) / a.popWalk, 1) : null,
    pct_motor_over_30_min: a.popMotor > 0 ? round((100 * a.popMotorOver30) / a.popMotor, 1) : null,
  };
}

/** Name key for matching across datasets: lower case, letters only. */
export const nameKey = (s: string) => s.normalize("NFKD").toLowerCase().replace(/[^a-z]/g, "");

/**
 * Province name matcher: COD-AB names plus documented aliases used by DHS, WFP, COD-PS and HeiGIT.
 * Returns the P-code or null (callers must report every null).
 */
export function makeProvinceMatcher(codab: { pcode: string; name: string }[]) {
  const ALIASES: Record<string, string> = {
    // key (nameKey of the other dataset's spelling) → COD-AB name
    kaohkong: "Koh Kong",
    banteymeanchey: "Banteay Meanchey",
    otdarmeanchey: "Oddar Meanchey",
    oddarmeanchey: "Oddar Meanchey",
    stuengtreng: "Stung Treng",
    steungtreng: "Stung Treng",
    mondolkiri: "Mondul Kiri",
    rattanakkiri: "Ratanak Kiri",
    ratanakiri: "Ratanak Kiri",
    siemreap: "Siemreap",
    krongpailin: "Pailin",
    krongkep: "Kep",
    krongpreahsihanouk: "Preah Sihanouk",
    sihanoukville: "Preah Sihanouk",
    tbongkhmum: "Tboung Khmum",
    tbaungkhmum: "Tboung Khmum",
  };
  const byKey = new Map(codab.map((p) => [nameKey(p.name), p.pcode]));
  return (name: string): string | null => {
    const k = nameKey(name.replace(/^\.+/, "").replace(/\s+province$/i, ""));
    if (byKey.has(k)) return byKey.get(k)!;
    const alias = ALIASES[k];
    return alias ? byKey.get(nameKey(alias)) ?? null : null;
  };
}

/** Median of a non-empty numeric array. */
export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Pearson correlation. */
export function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

/** Minimal CSV parser (quoted fields, commas inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

/** Stable JSON: object keys sorted recursively, so output bytes never depend on insertion order. */
export function stableStringify(v: unknown, space = 0): string {
  const sort = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(sort);
    if (x && typeof x === "object") {
      return Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, sort((x as Record<string, unknown>)[k])]));
    }
    return x;
  };
  return JSON.stringify(sort(v), null, space) + "\n";
}
