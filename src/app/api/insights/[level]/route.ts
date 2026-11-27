import { NextResponse } from "next/server";
import { LEVELS, mapGeoJson, type Level } from "@/server/insights/data";

/** Map layer for the Insights page: simplified boundaries + indicators. Prebuilt at build time. */
export const dynamic = "force-static";
export function generateStaticParams() {
  return LEVELS.map((level) => ({ level }));
}

export async function GET(_req: Request, ctx: RouteContext<"/api/insights/[level]">) {
  const { level } = await ctx.params;
  if (!LEVELS.includes(level as Level)) return NextResponse.json({ error: "Unknown level" }, { status: 404 });
  return NextResponse.json(mapGeoJson(level as Level), {
    headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
