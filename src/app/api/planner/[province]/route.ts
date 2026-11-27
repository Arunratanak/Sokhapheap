import { NextResponse } from "next/server";
import { planFor, provinces } from "@/server/insights/planner";

/** Screening plan for a province (open data only, no personal data). Prebuilt for all 25 provinces. */
export const dynamic = "force-static";
export function generateStaticParams() {
  return provinces().map((p) => ({ province: p.pcode }));
}

export async function GET(_req: Request, ctx: RouteContext<"/api/planner/[province]">) {
  const { province } = await ctx.params;
  const plan = /^KH\d{2}$/.test(province) ? planFor(province) : null;
  if (!plan) return NextResponse.json({ error: "Unknown province" }, { status: 404 });
  return NextResponse.json(plan, { headers: { "Cache-Control": "public, max-age=86400" } });
}
