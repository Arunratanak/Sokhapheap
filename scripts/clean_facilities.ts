/**
 * Builds data/clean/facilities.geojson from two open datasets:
 *   1. Ministry of Health health facilities (2010, via HDX) — shapefiles, Indian 1960 / UTM 48N
 *   2. OpenStreetMap health facilities export (HOT OSM, via HDX) — GeoJSON, WGS84
 * Province/district are assigned by point-in-polygon against the official
 * admin boundaries (HDX cod-ab-khm), because the 2010 MoH province names contain errors.
 *
 * Run: npm run data:facilities   (expects files in data/raw — see data/SOURCES.md)
 */
import fs from "node:fs";
import path from "node:path";
import * as shapefile from "shapefile";
import proj4 from "proj4";

const ROOT = path.resolve(__dirname, "..");
const RAW = path.join(ROOT, "data/raw");
const OUT = path.join(ROOT, "data/clean");

// Indian 1960 / UTM zone 48N. Datum shift = EPSG transformation for Indian 1960 → WGS 84
// south of 16°N (182, 915, 344). Validated empirically: median 75 m from matching OSM
// hospitals vs ~450 m with no shift (see facilities_report.md).
const INDIAN_1960_UTM48 =
  "+proj=utm +zone=48 +a=6377276.345 +rf=300.8017 +towgs84=182,915,344,0,0,0,0 +units=m +no_defs";

// Cambodia bounding box (generous; the admin polygon test below is the strict check).
export const CAMBODIA_BBOX = { minLng: 102.3, maxLng: 107.7, minLat: 9.9, maxLat: 14.7 };

export type FacilityType = "hospital" | "health_centre" | "health_post" | "clinic" | "other";
export type Source = "moh_2010" | "osm";

export interface Facility {
  id: string;
  name: string;
  name_km: string | null;
  type: FacilityType;
  province: string | null;
  district: string | null;
  lat: number;
  lng: number;
  source: Source;
}

type Ring = number[][];
type Poly = Ring[];
interface Area {
  name: string;
  parent?: string;
  polys: Poly[];
  bbox: [number, number, number, number];
}

// ---------- geometry helpers ----------
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLng = (lng2 - lng1) * r;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPoly(x: number, y: number, poly: Poly): boolean {
  if (!inRing(x, y, poly[0])) return false;
  for (let h = 1; h < poly.length; h++) if (inRing(x, y, poly[h])) return false;
  return true;
}

function loadAreas(file: string, nameKey: string, parentKey?: string): Area[] {
  const g = JSON.parse(fs.readFileSync(file, "utf8"));
  return g.features.map((f: { properties: Record<string, string>; geometry: { type: string; coordinates: unknown } }) => {
    const polys: Poly[] =
      f.geometry.type === "Polygon"
        ? [f.geometry.coordinates as Poly]
        : (f.geometry.coordinates as Poly[]);
    let [a, b, c, d] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of polys) for (const [x, y] of p[0]) {
      a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y);
    }
    return { name: f.properties[nameKey], parent: parentKey ? f.properties[parentKey] : undefined, polys, bbox: [a, b, c, d] };
  });
}

function findArea(areas: Area[], lng: number, lat: number): Area | undefined {
  return areas.find(
    (a) =>
      lng >= a.bbox[0] && lng <= a.bbox[2] && lat >= a.bbox[1] && lat <= a.bbox[3] &&
      a.polys.some((p) => inPoly(lng, lat, p)),
  );
}

// ---------- type mapping ----------
const KHMER = /[ក-៿]/;

/** Map OSM tags to our facility types. Returns null for things we exclude (pharmacies, dentists…). */
export function osmType(amenity: string | null, healthcare: string | null): FacilityType | null {
  const tags = [amenity, healthcare].filter(Boolean) as string[];
  if (tags.includes("hospital")) return "hospital";
  if (tags.some((t) => ["health_center", "health_centre", "centre"].includes(t))) return "health_centre";
  if (tags.some((t) => ["clinic", "doctors", "doctor"].includes(t))) return "clinic";
  return null; // pharmacy, dentist, laboratory, optometrist, blood bank, untagged…
}

// ---------- dedupe ----------
/** Drop records of the same type within `radiusM` of a record already kept. Input order = priority. */
export function dedupe(items: Facility[], radiusM = 200): { kept: Facility[]; removed: number } {
  const cell = 0.01; // ~1.1 km grid
  const grid = new Map<string, Facility[]>();
  const key = (lat: number, lng: number) => `${Math.floor(lat / cell)}:${Math.floor(lng / cell)}`;
  const kept: Facility[] = [];
  let removed = 0;
  for (const f of items) {
    const gy = Math.floor(f.lat / cell);
    const gx = Math.floor(f.lng / cell);
    let dup = false;
    for (let dy = -1; dy <= 1 && !dup; dy++)
      for (let dx = -1; dx <= 1 && !dup; dx++)
        for (const k of grid.get(`${gy + dy}:${gx + dx}`) ?? [])
          if (k.type === f.type && haversineMeters(k.lat, k.lng, f.lat, f.lng) <= radiusM) {
            dup = true;
            break;
          }
    if (dup) {
      removed++;
      continue;
    }
    kept.push(f);
    const kk = key(f.lat, f.lng);
    grid.set(kk, [...(grid.get(kk) ?? []), f]);
  }
  return { kept, removed };
}

// ---------- loaders ----------
const MOH_LAYERS: { file: string; type: FacilityType }[] = [
  { file: "khm_hltfacp_referral_gov.shp", type: "hospital" },
  { file: "khm_hltfacp_healthcenter_gov.shp", type: "health_centre" },
  { file: "khm_hltfacp_healthpost_gov.shp", type: "health_post" },
  // khm_hltfacp_od_gov.shp = Operational District offices (administrative), not care points → excluded.
];

async function loadMoh(): Promise<Facility[]> {
  const out: Facility[] = [];
  // FACILITCOD is not unique in the 2010 data (e.g. 10 Mondul Kiri health posts share 110108),
  // so repeats get a numbered suffix to keep every facility with a unique id.
  const seen = new Map<string, number>();
  for (const layer of MOH_LAYERS) {
    const src = await shapefile.open(path.join(RAW, "moh/Health", layer.file));
    for (let r = await src.read(); !r.done; r = await src.read()) {
      const p = r.value.properties as Record<string, string | number | null>;
      const g = r.value.geometry as { coordinates: number[] } | null;
      if (!g) continue;
      const [lng, lat] = proj4(INDIAN_1960_UTM48, "WGS84", g.coordinates);
      const raw = String(p.FACILITNAM ?? "").trim();
      const suffix = { hospital: "Referral Hospital", health_centre: "Health Centre", health_post: "Health Post" }[
        layer.type as "hospital" | "health_centre" | "health_post"
      ];
      const name = !raw ? suffix : /hospital|health/i.test(raw) ? raw : `${raw} ${suffix}`;
      const baseId = `moh_${layer.type}_${p.FACILITCOD ?? out.length}`;
      const n = (seen.get(baseId) ?? 0) + 1;
      seen.set(baseId, n);
      out.push({
        id: n === 1 ? baseId : `${baseId}_${n}`,
        name,
        name_km: null,
        type: layer.type,
        province: null,
        district: null,
        lat,
        lng,
        source: "moh_2010",
      });
    }
  }
  return out;
}

const osmStats: Record<string, number> = {};

function loadOsm(): Facility[] {
  const g = JSON.parse(fs.readFileSync(path.join(RAW, "osm/health_facilities.geojson"), "utf8"));
  const out: Facility[] = [];
  for (const f of g.features) {
    const p = f.properties;
    const type = osmType(p.amenity, p.healthcare);
    if (!type) {
      const k = `excluded:${p.amenity ?? p.healthcare ?? "untagged"}`;
      osmStats[k] = (osmStats[k] ?? 0) + 1;
      continue;
    }
    let lng: number, lat: number;
    if (f.geometry?.type === "Point") [lng, lat] = f.geometry.coordinates;
    else if (f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon") {
      const ring: number[][] = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
      lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    } else continue;
    const nameKm = p.name_km ?? (p.name && KHMER.test(p.name) ? p.name : null);
    const nameEn = p.name_en ?? p.name_latin ?? (p.name && !KHMER.test(p.name) ? p.name : null);
    const name = nameEn ?? nameKm;
    if (!name) {
      osmStats["excluded:no_name"] = (osmStats["excluded:no_name"] ?? 0) + 1;
      continue;
    }
    out.push({ id: `osm_${String(p.id).replace("/", "_")}`, name, name_km: nameKm, type, province: null, district: null, lat, lng, source: "osm" });
  }
  return out;
}

// ---------- main ----------
async function main() {
  const adm1 = loadAreas(path.join(RAW, "admin/khm_admin1.geojson"), "adm1_name");
  const adm2 = loadAreas(path.join(RAW, "admin/khm_admin2.geojson"), "adm2_name", "adm1_name");

  const moh = await loadMoh();
  const osm = loadOsm();
  const input = { moh: moh.length, osm: osm.length };

  let droppedCoords = 0;
  const located: Facility[] = [];
  for (const f of [...osm, ...moh]) {
    const b = CAMBODIA_BBOX;
    if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng) || f.lng < b.minLng || f.lng > b.maxLng || f.lat < b.minLat || f.lat > b.maxLat) {
      droppedCoords++;
      continue;
    }
    const d = findArea(adm2, f.lng, f.lat);
    const p = d ? undefined : findArea(adm1, f.lng, f.lat);
    if (!d && !p) {
      droppedCoords++; // outside Cambodia's land/sea admin boundary
      continue;
    }
    located.push({ ...f, district: d?.name ?? null, province: d?.parent ?? p!.name, lat: +f.lat.toFixed(6), lng: +f.lng.toFixed(6) });
  }

  // OSM first → OSM wins over MoH 2010 when both describe the same facility.
  const { kept, removed } = dedupe(located, 200);

  fs.mkdirSync(OUT, { recursive: true });
  const geojson = {
    type: "FeatureCollection",
    features: kept.map((f) => ({ type: "Feature", geometry: { type: "Point", coordinates: [f.lng, f.lat] }, properties: f })),
  };
  fs.writeFileSync(path.join(OUT, "facilities.geojson"), JSON.stringify(geojson));

  // ---------- report ----------
  const count = <K extends string>(fn: (f: Facility) => K) =>
    kept.reduce<Record<string, number>>((acc, f) => ((acc[fn(f)] = (acc[fn(f)] ?? 0) + 1), acc), {});
  const bySource = count((f) => f.source);
  const byType = count((f) => f.type);
  const byProvince = count((f) => f.province ?? "unknown");
  const provinces = adm1.map((a) => a.name).sort();
  const missing = provinces.filter((p) => !byProvince[p]);
  const table = (o: Record<string, number>) =>
    Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join("\n");

  const report = `# Facilities cleaning report

Generated by \`scripts/clean_facilities.ts\` on ${new Date().toISOString().slice(0, 10)}.

## Totals

| Step | Count |
|---|---|
| MoH 2010 records read (referral hospitals, health centres, health posts) | ${input.moh} |
| OSM records kept after type filter | ${input.osm} |
| Dropped: invalid coordinates or outside Cambodia | ${droppedCoords} |
| Duplicates removed (same type within 200 m; OSM preferred) | ${removed} |
| **Final facilities** | **${kept.length}** |

## By source

| Source | Count |
|---|---|
${table(bySource)}

## By type

| Type | Count |
|---|---|
${table(byType)}

## By province (${Object.keys(byProvince).filter((p) => p !== "unknown").length} of ${provinces.length} provinces represented)

| Province | Count |
|---|---|
${table(byProvince)}
${missing.length ? `\n**Provinces with no facilities:** ${missing.join(", ")}\n` : ""}
## OSM records excluded by type

Pharmacies, dentists and other non-primary-care places are excluded because the app refers people
for diabetes and heart-risk follow-up.

| Reason | Count |
|---|---|
${table(osmStats)}

## Notes

- MoH Operational District offices (\`khm_hltfacp_od_gov\`) are administrative offices, not care points, and are excluded.
- MoH coordinates were converted from Indian 1960 / UTM 48N to WGS84 using the Indian 1960 → WGS84
  datum shift for south of 16°N (dx=182, dy=915, dz=344). Check: MoH referral hospitals sit a median
  ~75 m from the nearest OSM hospital (vs ~450 m without the datum shift).
- Province and district come from the official admin boundaries (HDX cod-ab-khm), not the 2010 attribute
  table, which has mislabelled provinces.
- OSM polygons (hospital grounds) are reduced to the average of their outline points.
`;
  fs.writeFileSync(path.join(OUT, "facilities_report.md"), report);
  console.log(`Wrote ${kept.length} facilities (${removed} duplicates removed, ${droppedCoords} dropped).`);
}

if (process.argv[1] && /clean_facilities/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
