import { NextResponse } from "next/server";
import { mergedAreas } from "@/lib/insights/data";
import { limited, ok } from "@/lib/insights/publicApi";

/** GET /api/open-data/areas?level=province|district — every area with its indicators and gap index. */
export async function GET(req: Request) {
  const block = limited(req);
  if (block) return block;
  const level = new URL(req.url).searchParams.get("level") ?? "province";
  if (level !== "province" && level !== "district")
    return NextResponse.json({ error: "level must be 'province' or 'district' (communes: /api/open-data/areas/<pcode>)" }, { status: 400 });
  const data = mergedAreas(level);
  return ok(data, { level, count: data.length });
}
