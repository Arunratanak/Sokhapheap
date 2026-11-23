import { manifest } from "@/lib/insights/data";
import { limited, ok } from "@/lib/insights/publicApi";

/** GET /api/open-data/sources — every dataset used, with publisher, licence, year (from data/manifest.json). */
export async function GET(req: Request) {
  const block = limited(req);
  if (block) return block;
  const data = manifest();
  return ok(data, { count: data.length });
}
