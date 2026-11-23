import { NextResponse } from "next/server";
import { z } from "zod";
import { zodError } from "@/lib/api";
import { areaSummary } from "@/lib/insights/area";

/**
 * "Your area" card data. Either ?lat=&lng= (the user's location) or ?district=<P-code> (dropdowns).
 * PRIVACY: the location is used only for this lookup — it is not stored, logged or echoed back,
 * and the response is marked private / no-store so no cache keeps it.
 */
const schema = z.union([
  z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) }).strict(),
  z.object({ district: z.string().regex(/^KH\d{4}$/, "district must be a P-code like KH0102") }).strict(),
]);

export async function GET(req: Request) {
  const parsed = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return zodError(parsed.error);
  const summary = areaSummary(parsed.data);
  if (!summary) return NextResponse.json({ error: "No area found for this location or district." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
}
