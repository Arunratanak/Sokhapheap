import { NextResponse } from "next/server";
import { FACILITY_TYPES, loadFacilities } from "@/server/data/facilities";

/**
 * Compact list of every facility for the map: [lat, lng, typeIndex, name, name_km].
 * ~1,400 rows; small after gzip and cached for a day.
 */
export async function GET() {
  // 4 decimals ≈ 11 m — plenty for map markers, and a smaller payload on slow networks.
  const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
  const rows = loadFacilities().map((f) => [r4(f.lat), r4(f.lng), FACILITY_TYPES.indexOf(f.type), f.name, f.name_km && f.name_km !== f.name ? f.name_km : ""]);
  return NextResponse.json({ types: FACILITY_TYPES, rows }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
