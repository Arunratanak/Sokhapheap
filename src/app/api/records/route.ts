import { NextResponse } from "next/server";
import { sessionUser, logoutEverywhere } from "@/server/auth/telegramLogin";
import { deleteAllRecords, listRecords, saveRecord } from "@/server/db/records";
import { recordInputSchema } from "@/domain/records";
import { badRequest, readJson, zodError } from "@/server/http/api";
import { rateLimit } from "@/server/http/rateLimit";

const noStore = { "Cache-Control": "no-store" };
const unauthorized = (status: 401 | 503) =>
  NextResponse.json({ error: status === 401 ? "unauthorized" : "unavailable" }, { status, headers: noStore });

/** The logged-in person's saved records (web and bot), newest first. */
export async function GET(req: Request) {
  const who = await sessionUser(req);
  if (!who.ok) return unauthorized(who.status);
  const records = await listRecords(who.telegramUserId);
  if (!records) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  return NextResponse.json({ records }, { headers: noStore });
}

/** Save a result. Body: { kind: "health_check" | "risk" | "lab", data } (see src/domain/records.ts). */
export async function POST(req: Request) {
  const who = await sessionUser(req);
  if (!who.ok) return unauthorized(who.status);
  if (!rateLimit(`records-save:${who.telegramUserId}`, 30, 60_000).ok)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const body = await readJson(req);
  if (!body.ok) return badRequest("Request body must be JSON");
  const parsed = recordInputSchema.safeParse(body.data);
  if (!parsed.success) return zodError(parsed.error);
  const id = await saveRecord(who.telegramUserId, "web", parsed.data);
  if (!id) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ id }, { status: 201 });
}

/** "Delete my records": deletes every saved record and logs out every browser. */
export async function DELETE(req: Request) {
  const who = await sessionUser(req);
  if (!who.ok) return unauthorized(who.status);
  const ok = await deleteAllRecords(who.telegramUserId);
  if (!ok) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  await logoutEverywhere(who.telegramUserId);
  return NextResponse.json({ ok: true });
}
