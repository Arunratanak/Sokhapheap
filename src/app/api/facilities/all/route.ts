import { NextResponse } from "next/server";
import { FACILITY_TYPES, loadFacilities } from "@/lib/facilities";

/**
 * Compact list of every facility for the map: [lat, lng, typeIndex, name, name_km].
 * ~1,400 rows; small after gzip and cached for a day.
 */
export async function GET() {
  const rows = loadFacilities().map((f) => [f.lat, f.lng, FACILITY_TYPES.indexOf(f.type), f.name, f.name_km ?? ""]);
  return NextResponse.json({ types: FACILITY_TYPES, rows }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
