import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/lib/db/supabase";
import { getBot } from "@/lib/bot/bot";
import { getRawDictionary } from "@/lib/i18n";

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const got = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Sends due reminders. Called once a day by .github/workflows/reminders.yml. */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getServiceClient();
  const bot = getBot();
  if (!db || !bot) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("reminders")
    .select("id, telegram_chat_id")
    .lte("remind_on", today)
    .is("sent_at", null)
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reminder text in both languages (we don't store language preference).
  const text = `${getRawDictionary("km").bot.reminderMessage}\n\n${getRawDictionary("en").bot.reminderMessage}`;
  let sent = 0;
  let failed = 0;
  for (const r of data ?? []) {
    try {
      await bot.api.sendMessage(r.telegram_chat_id, text);
      await db.from("reminders").update({ sent_at: new Date().toISOString() }).eq("id", r.id);
      sent++;
    } catch {
      failed++;
    }
  }
  return NextResponse.json({ due: data?.length ?? 0, sent, failed });
}
