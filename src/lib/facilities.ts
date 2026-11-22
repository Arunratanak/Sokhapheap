import fs from "node:fs";
import path from "node:path";

export type FacilityType = "hospital" | "health_centre" | "health_post" | "clinic" | "other";

export interface Facility {
  id: string;
  name: string;
  name_km: string | null;
  type: FacilityType;
  province: string;
  district: string | null;
  lat: number;
  lng: number;
  source: "moh_2010" | "osm";
}

export interface FacilityWithDistance extends Facility {
  distance_m: number;
}

export const FACILITY_TYPES: FacilityType[] = ["hospital", "health_centre", "health_post", "clinic", "other"];

let cache: Facility[] | null = null;

/** Facilities from the committed clean open-data file (same data that is seeded into Supabase). */
export function loadFacilities(): Facility[] {
  if (!cache) {
    const file = path.join(process.cwd(), "data/clean/facilities.geojson");
    const geo = JSON.parse(fs.readFileSync(file, "utf8"));
    cache = geo.features.map((f: { properties: Facility }) => f.properties);
  }
  return cache!;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearestLocal(
  lat: number,
  lng: number,
  limit = 5,
  types?: FacilityType[] | null,
): FacilityWithDistance[] {
  return loadFacilities()
    .filter((f) => !types?.length || types.includes(f.type))
    .map((f) => ({ ...f, distance_m: haversineMeters(lat, lng, f.lat, f.lng) }))
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, Math.min(Math.max(limit, 1), 50));
}

const TYPE_ORDER: Record<FacilityType, number> = { hospital: 0, health_centre: 1, clinic: 2, health_post: 3, other: 4 };

export function byAreaLocal(province: string, district?: string | null, types?: FacilityType[] | null): Facility[] {
  return loadFacilities()
    .filter(
      (f) =>
        f.province === province &&
        (!district || f.district === district) &&
        (!types?.length || types.includes(f.type)),
    )
    .sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.name.localeCompare(b.name));
}

/** Province → sorted district list, for the "no location" dropdowns. */
export function listAreas(): { province: string; districts: string[] }[] {
  const map = new Map<string, Set<string>>();
  for (const f of loadFacilities()) {
    if (!map.has(f.province)) map.set(f.province, new Set());
    if (f.district) map.get(f.province)!.add(f.district);
  }
  return [...map.entries()]
    .map(([province, d]) => ({ province, districts: [...d].sort() }))
    .sort((a, b) => a.province.localeCompare(b.province));
}

export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
