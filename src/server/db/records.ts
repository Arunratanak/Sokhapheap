import "server-only";
import { getServiceClient, withTimeout } from "./supabase";
import { recordInputSchema, type RecordInput, type SavedRecord } from "../../domain/records";

/** Saved records of a logged-in person, keyed by their numeric Telegram user ID (web and bot share them). */

export const MAX_RECORDS_LISTED = 100;

/** Save one record. Never throws: saving must not block a result. Returns the new id, or null. */
export async function saveRecord(telegramUserId: number, channel: "web" | "bot", record: RecordInput): Promise<string | null> {
  const db = getServiceClient();
  if (!db) return null;
  const parsed = recordInputSchema.safeParse(record);
  if (!parsed.success) {
    console.error("saveRecord: invalid record", parsed.error.issues[0]?.message);
    return null;
  }
  try {
    const { data, error } = await withTimeout(
      db.from("health_records")
        .insert({ telegram_user_id: telegramUserId, channel, kind: parsed.data.kind, data: parsed.data.data })
        .select("id")
        .single(),
    );
    if (error) throw new Error(error.message);
    return String(data.id);
  } catch (e) {
    console.error("saveRecord:", (e as Error).message);
    return null;
  }
}

/** Newest first. null = database unavailable. Rows that no longer match the schema are skipped. */
export async function listRecords(telegramUserId: number, limit = MAX_RECORDS_LISTED): Promise<SavedRecord[] | null> {
  const db = getServiceClient();
  if (!db) return null;
  try {
    const { data, error } = await withTimeout(
      db.from("health_records").select("id, created_at, channel, kind, data")
        .eq("telegram_user_id", telegramUserId).order("created_at", { ascending: false }).limit(limit),
    );
    if (error) throw new Error(error.message);
    const out: SavedRecord[] = [];
    for (const row of data ?? []) {
      const parsed = recordInputSchema.safeParse({ kind: row.kind, data: row.data });
      if (parsed.success) out.push({ ...parsed.data, id: String(row.id), createdAt: String(row.created_at), channel: row.channel });
    }
    return out;
  } catch (e) {
    console.error("listRecords:", (e as Error).message);
    return null;
  }
}

export async function deleteRecord(telegramUserId: number, id: string): Promise<boolean> {
  const db = getServiceClient();
  if (!db) return false;
  try {
    // Scoped to the owner: someone else's id deletes nothing.
    const { error } = await withTimeout(db.from("health_records").delete().eq("id", id).eq("telegram_user_id", telegramUserId));
    return !error;
  } catch {
    return false;
  }
}

export async function deleteAllRecords(telegramUserId: number): Promise<boolean> {
  const db = getServiceClient();
  if (!db) return false;
  try {
    const { error } = await withTimeout(db.from("health_records").delete().eq("telegram_user_id", telegramUserId));
    return !error;
  } catch {
    return false;
  }
}
