import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getServiceClient, withTimeout } from "@/server/db/supabase";
import { aggregate } from "@/domain/orgStats";
import { readJson } from "@/server/http/api";
import { clientIp, rateLimit } from "@/server/http/rateLimit";

function codeOk(given: unknown): boolean {
  const expected = process.env.ORG_DASHBOARD_ACCESS_CODE;
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Returns ONLY anonymous aggregates for an organization. Individual rows never leave the server.
 * POST body: { accessCode }
 */
export async function POST(req: Request, ctx: RouteContext<"/api/org/[code]">) {
  if (!rateLimit(`org:${clientIp(req)}`, 10, 60_000).ok)
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  const { code } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(code)) return NextResponse.json({ error: "Invalid organization code" }, { status: 400 });
  const body = await readJson(req);
  if (!body.ok || !codeOk((body.data as { accessCode?: unknown })?.accessCode))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  try {
    const { data: org } = await withTimeout(db.from("organizations").select("name, is_demo").eq("org_code", code).maybeSingle());
    if (!org) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { data: rows, error } = await withTimeout(
      db.from("screenings").select("findrisc_band, cvd_band, province").eq("org_code", code).limit(100_000),
      8000,
    );
    if (error) throw new Error(error.message);
    return NextResponse.json(
      { name: org.name, stats: aggregate(rows ?? [], org.is_demo) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
}
