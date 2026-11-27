import { NextResponse } from "next/server";
import { listAreas } from "@/server/data/facilities";

/** Province → district list for the "no location" dropdowns. */
export async function GET() {
  return NextResponse.json({ areas: listAreas() }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
