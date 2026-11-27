import { mergedAreas, type Level } from "@/server/insights/data";
import { limited, notFound, ok } from "@/server/insights/publicApi";

/** GET /api/open-data/areas/<P-code> — one province (KH12), district (KH1201) or commune (KH120101). */
export async function GET(req: Request, ctx: RouteContext<"/api/open-data/areas/[pcode]">) {
  const block = limited(req);
  if (block) return block;
  const { pcode } = await ctx.params;
  const level: Level | null = /^KH\d{2}$/.test(pcode) ? "province" : /^KH\d{4}$/.test(pcode) ? "district" : /^KH\d{6}$/.test(pcode) ? "commune" : null;
  if (!level) return notFound("Unknown P-code. Use KH + 2 (province), 4 (district) or 6 (commune) digits, e.g. KH1201.");
  const area = mergedAreas(level).find((a) => a.pcode === pcode);
  if (!area) return notFound(`No area with P-code ${pcode}.`);
  return ok(area, { level });
}
