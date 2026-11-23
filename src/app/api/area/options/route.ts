import { NextResponse } from "next/server";
import { areaOptions } from "@/lib/insights/area";

/** Provinces and their districts (P-codes) for the "Your area" dropdowns. Prebuilt at build time. */
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(areaOptions(), { headers: { "Cache-Control": "public, max-age=86400" } });
}
