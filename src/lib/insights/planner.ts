import "server-only";
import fs from "node:fs";
import path from "node:path";
import { areas, gap, manifest, nationalContext } from "./data";
import { loadFacilities } from "@/lib/facilities";
import type { ComponentId } from "./gapIndexConfig";

/**
 * Screening planner (Phase 6): "where to screen next" in a province, from open data only.
 * No personal data is involved — everything comes from data/clean.
 */
export interface PlanDistrict {
  pcode: string;
  name: string;
  rankInProvince: number;
  rankNational: number;
  index: number;
  drivers: ComponentId[];
  population: number;
  adults: number | null;
  travelMotorMin: number | null;
  pctWalkOver60: number | null;
  facilitiesPer10k: number | null;
  healthCentres: { name: string; lat: number; lng: number }[];
}
export interface Plan {
  province: { pcode: string; name: string };
  districtsInProvince: number;
  top: PlanDistrict[];
  dhs: Record<string, number | null>;
  nationalDiabetes: { value: number; year: number } | null;
  sources: { name: string; publisher: string; licence: string; year: string; url: string }[];
}

export function provinces() {
  return areas("province").map((p) => ({ pcode: p.pcode, name: p.name_en })).sort((a, b) => a.name.localeCompare(b.name));
}

export function planFor(provincePcode: string, n = 5): Plan | null {
  const prov = areas("province").find((p) => p.pcode === provincePcode);
  if (!prov) return null;
  const districtData = new Map(areas("district").map((d) => [d.pcode, d]));
  const inProv = gap("district").filter((g) => g.province_pcode === provincePcode); // already sorted by national rank
  const facilities = loadFacilities().filter((f) => f.type === "health_centre" && f.province === prov.name_en);

  const top = inProv.slice(0, n).map((g, i) => {
    const d = districtData.get(g.pcode)!;
    return {
      pcode: g.pcode,
      name: g.name_en,
      rankInProvince: i + 1,
      rankNational: g.rank,
      index: g.index,
      drivers: g.drivers,
      population: d.population,
      adults: d.adults_20plus_est,
      travelMotorMin: d.travel_motor_mean_min,
      pctWalkOver60: d.pct_walk_over_60_min,
      facilitiesPer10k: d.facilities_per_10k,
      healthCentres: facilities
        .filter((f) => f.district === g.name_en)
        .map((f) => ({ name: f.name, lat: f.lat, lng: f.lng }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  const dm = nationalContext().indicators.diabetes_prevalence_agestd_pct;
  const used = new Set(["cod-ab", "worldpop", "map-travel-time", "moh-facilities", "osm-facilities", "dhs-2021", "who-gho", "cod-ps"]);
  return {
    province: { pcode: prov.pcode, name: prov.name_en },
    districtsInProvince: inProv.length,
    top,
    dhs: prov.dhs ?? {},
    nationalDiabetes: dm && dm.value !== null ? { value: dm.value, year: dm.year } : null,
    sources: manifest()
      .filter((m) => used.has(m.id))
      .map((m) => ({ name: m.name, publisher: m.publisher, licence: m.licence, year: m.data_year, url: m.url })),
  };
}

/** SVG outline of a province's districts (equirectangular), for the printable plan. */
export function provinceSvg(provincePcode: string, highlight: Map<string, number>, colourOf: (pcode: string) => string) {
  const gj = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/clean/boundaries_district.geojson"), "utf8")) as {
    features: { properties: Record<string, string>; geometry: { type: string; coordinates: unknown } }[];
  };
  const feats = gj.features.filter((f) => f.properties.adm1_pcode === provincePcode);
  const ringsOf = (g: { type: string; coordinates: unknown }) =>
    g.type === "Polygon" ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of feats) for (const poly of ringsOf(f.geometry)) for (const ring of poly) for (const [x, y] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const W = 400;
  const scale = W / ((maxX - minX) * k);
  const H = Math.round((maxY - minY) * scale);
  const px = (x: number, y: number) => [((x - minX) * k * scale).toFixed(1), ((maxY - y) * scale).toFixed(1)];
  const shapes = feats.map((f) => {
    const pc = f.properties.adm2_pcode;
    const d = ringsOf(f.geometry)
      .flatMap((poly) => poly.map((ring) => "M" + ring.map(([x, y]) => px(x, y).join(",")).join("L") + "Z"))
      .join("");
    let sx = 0, sy = 0, n = 0;
    for (const poly of ringsOf(f.geometry)) for (const [x, y] of poly[0]) { sx += x; sy += y; n++; }
    const [cx, cy] = px(sx / n, sy / n);
    return { pcode: pc, name: f.properties.adm2_name, d, cx: Number(cx), cy: Number(cy), fill: colourOf(pc), label: highlight.get(pc) ?? null };
  });
  return { width: W, height: H, shapes };
}
