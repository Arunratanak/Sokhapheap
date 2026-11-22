import "server-only";
import { getServiceClient, withTimeout } from "./db/supabase";
import type { RiskResult } from "./risk";

/** Save an anonymous screening. Never throws — saving must not block the user's result. */
export async function saveScreening(
  result: RiskResult,
  meta: { channel: "web" | "bot"; province?: string | null; orgCode?: string | null },
): Promise<boolean> {
  const db = getServiceClient();
  if (!db) return false;
  try {
    const row = {
      channel: meta.channel,
      findrisc_score: result.findrisc.score,
      findrisc_band: result.findrisc.band,
      cvd_band: result.cvd.available ? result.cvd.band : null,
      province: meta.province ?? null,
      org_code: meta.orgCode ?? null,
    };
    let { error } = await withTimeout(db.from("screenings").insert(row));
    // Unknown org code (foreign key) → save without it rather than lose the screening.
    if (error?.code === "23503") ({ error } = await withTimeout(db.from("screenings").insert({ ...row, org_code: null })));
    if (error) console.error("saveScreening:", error.message);
    return !error;
  } catch (e) {
    console.error("saveScreening:", (e as Error).message);
    return false;
  }
}
