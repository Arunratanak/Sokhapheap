import "server-only";
import fs from "node:fs";
import path from "node:path";
import { areas, nationalContext, provinceNames } from "./data";
import { nearestLocal } from "@/lib/facilities";

/**
 * "Your area" lookup (Phase 5). Shared by the web results card (/api/area) and the Telegram bot.
 * PRIVACY: a user's location is used only inside this function call to find their commune/district
 * and nearest health centre. It is never stored, logged or returned.
 */

type Ring = number[][];
interface Poly { pcode: string; district: string; province: string; bbox: [number, number, number, number]; rings: Ring[] }

let communePolys: Poly[] | null = null;
function loadCommunes(): Poly[] {
  if (communePolys) return communePolys;
  const gj = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/clean/boundaries_commune.geojson"), "utf8")) as {
    features: { properties: Record<string, string>; geometry: { type: string; coordinates: unknown } }[];
  };
  communePolys = gj.features.map((f) => {
    const rings: Ring[] = f.geometry.type === "Polygon" ? (f.geometry.coordinates as Ring[]) : (f.geometry.coordinates as Ring[][]).flat();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rings) for (const [x, y] of r) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return { pcode: f.properties.adm3_pcode, district: f.properties.adm2_pcode, province: f.properties.adm1_pcode, bbox: [minX, minY, maxX, maxY], rings };
  });
  return communePolys;
}

function inRings(x: number, y: number, rings: Ring[]): boolean {
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

/** Commune / district / province P-codes containing a point, or null if outside Cambodia's communes. */
export function locatePoint(lat: number, lng: number): { commune: string; district: string; province: string } | null {
  const c = loadCommunes().find((p) => lng >= p.bbox[0] && lng <= p.bbox[2] && lat >= p.bbox[1] && lat <= p.bbox[3] && inRings(lng, lat, p.rings));
  return c ? { commune: c.pcode, district: c.district, province: c.province } : null;
}

/** Province → districts (P-codes and names) for the dropdowns. */
export function areaOptions() {
  const districts = areas("district");
  return areas("province")
    .map((p) => ({
      pcode: p.pcode,
      name: p.name_en,
      districts: districts.filter((d) => d.province_pcode === p.pcode).map((d) => ({ pcode: d.pcode, name: d.name_en })).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface AreaSummary {
  province: { pcode: string; name: string };
  district: { pcode: string; name: string };
  commune: { pcode: string; name: string } | null;
  /** DHS 2021–22, province level, women 15–49. */
  womenOverweightPct: number | null;
  menSmokePct: number | null;
  /** MAP 2019 + WorldPop 2025, district level. */
  travelMotorMin: number | null;
  pctWalkOver60: number | null;
  /** Nearest health centre: from the user's point if given, else from the commune centre (if known). */
  nearestHealthCentre: { name: string; nameKm: string | null; km: number; from: "you" | "commune_centre" } | null;
  /** WHO national comparison. */
  nationalHypertensionPct: { value: number; year: number } | null;
  nationalDiabetesPct: { value: number; year: number } | null;
  /** WFP market price tip (only when data exists for the province). */
  vegPrice: { commodity: string; khrPerKg: number; from: string; to: string } | null;
  insightsLink: string;
}

let food: { period: { from: string; to: string }; provinces: Record<string, Record<string, { median_khr_per_kg: number }>> } | null = null;
function vegPrice(province: string) {
  food ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/clean/food_prices_province.json"), "utf8"));
  const p = food!.provinces[province];
  if (!p) return null;
  // Prefer common everyday vegetables; first one available wins.
  for (const c of ["Water spinach", "Cabbage (chinese, flowering)", "Beans (yardlong, green)", "Eggplants"]) {
    if (p[c]) return { commodity: c, khrPerKg: p[c].median_khr_per_kg, from: food!.period.from, to: food!.period.to };
  }
  return null;
}

/** Build the area card from a district P-code (dropdowns) or a point (location). */
export function areaSummary(input: { district: string } | { lat: number; lng: number }): AreaSummary | null {
  let districtPcode: string;
  let communePcode: string | null = null;
  let point: { lat: number; lng: number } | null = null;
  if ("district" in input) districtPcode = input.district;
  else {
    const hit = locatePoint(input.lat, input.lng);
    if (!hit) return null;
    districtPcode = hit.district;
    communePcode = hit.commune;
    point = { lat: input.lat, lng: input.lng };
  }

  const d = areas("district").find((x) => x.pcode === districtPcode);
  if (!d) return null;
  const provinceP = String(d.province_pcode);
  const prov = areas("province").find((x) => x.pcode === provinceP)!;
  const c = communePcode ? areas("commune").find((x) => x.pcode === communePcode) ?? null : null;

  let nearestHealthCentre: AreaSummary["nearestHealthCentre"] = null;
  if (point) {
    const [hc] = nearestLocal(point.lat, point.lng, 1, ["health_centre"]);
    if (hc) nearestHealthCentre = { name: hc.name, nameKm: hc.name_km, km: Math.round(hc.distance_m / 100) / 10, from: "you" };
  } else if (c?.nearest_health_centre?.name) {
    nearestHealthCentre = { name: c.nearest_health_centre.name, nameKm: null, km: c.nearest_health_centre.km ?? 0, from: "commune_centre" };
  }

  const nat = nationalContext().indicators;
  const pick = (k: string) => {
    const x = nat[k];
    return x && x.value !== null ? { value: x.value, year: x.year } : null;
  };

  return {
    province: { pcode: prov.pcode, name: provinceNames().get(prov.pcode) ?? prov.name_en },
    district: { pcode: d.pcode, name: d.name_en },
    commune: c ? { pcode: c.pcode, name: c.name_en } : null,
    womenOverweightPct: d.dhs?.women_overweight_or_obese_pct ?? null,
    menSmokePct: d.dhs?.men_smoke_tobacco_pct ?? null,
    travelMotorMin: d.travel_motor_mean_min,
    pctWalkOver60: d.pct_walk_over_60_min,
    nearestHealthCentre,
    nationalHypertensionPct: pick("hypertension_30_79_agestd_pct"),
    nationalDiabetesPct: pick("diabetes_prevalence_agestd_pct"),
    vegPrice: vegPrice(prov.pcode),
    insightsLink: `insights?area=${d.pcode}`,
  };
}
