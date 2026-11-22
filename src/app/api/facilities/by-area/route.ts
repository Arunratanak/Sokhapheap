import { NextResponse } from "next/server";
import { byAreaQuerySchema } from "@/lib/schemas";
import { badRequest, zodError } from "@/lib/api";
import { byAreaLocal, listAreas } from "@/lib/facilities";

export async function GET(req: Request) {
  const parsed = byAreaQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return zodError(parsed.error);
  const { province, district } = parsed.data;

  const area = listAreas().find((a) => a.province === province);
  if (!area) return badRequest(`Unknown province: ${province}`);
  if (district && !area.districts.includes(district)) return badRequest(`Unknown district in ${province}: ${district}`);

  return NextResponse.json(
    { facilities: byAreaLocal(province, district ?? null) },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
