import { NextResponse } from "next/server";
import { nearestQuerySchema } from "@/lib/schemas";
import { zodError } from "@/lib/api";
import { getAnonClient, withTimeout } from "@/lib/db/supabase";
import { nearestLocal, type FacilityWithDistance } from "@/lib/facilities";

export async function GET(req: Request) {
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = nearestQuerySchema.safeParse(q);
  if (!parsed.success) return zodError(parsed.error);
  const { lat, lng, limit, type } = parsed.data;

  // Database first (public read under RLS); fall back to the bundled open-data file.
  let facilities: FacilityWithDistance[] | null = null;
  let source: "database" | "file" = "file";
  const db = getAnonClient();
  if (db) {
    try {
      const { data, error } = await withTimeout(
        db.rpc("nearest_facilities", { p_lat: lat, p_lng: lng, p_limit: limit, p_types: type ? [type] : null }),
        3000,
      );
      if (!error && Array.isArray(data) && data.length) {
        facilities = data as FacilityWithDistance[];
        source = "database";
      }
    } catch {
      /* fall through to file */
    }
  }
  facilities ??= nearestLocal(lat, lng, limit, type ? [type] : null);

  return NextResponse.json(
    { facilities: facilities.map((f) => ({ ...f, distance_m: Math.round(f.distance_m) })), source },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
