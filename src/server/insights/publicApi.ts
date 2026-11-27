import "server-only";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/server/http/rateLimit";

/** Shared envelope + headers for the public open-data API (read-only, cached, rate-limited). */
export const LICENCE = "CC BY 4.0";
export const CITATION =
  "SokhaPheap open data (2026), derived from COD-AB, COD-PS, WorldPop, Malaria Atlas Project, Ministry of Health, OpenStreetMap, DHS 2021–22 and WHO. Sources and licences: /api/open-data/sources";
export const RATE_LIMIT = { requests: 60, windowMs: 60_000 };

export function limited(req: Request): NextResponse | null {
  const r = rateLimit(`open-data:${clientIp(req)}`, RATE_LIMIT.requests, RATE_LIMIT.windowMs);
  if (r.ok) return null;
  return NextResponse.json(
    { error: "Too many requests. The limit is 60 requests per minute.", licence: LICENCE },
    { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
  );
}

export function ok(data: unknown, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { licence: LICENCE, licence_url: "https://creativecommons.org/licenses/by/4.0/", citation: CITATION, ...extra, data },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
        "X-License": "CC-BY-4.0",
      },
    },
  );
}

export function notFound(message: string) {
  return NextResponse.json({ error: message, licence: LICENCE }, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
}
