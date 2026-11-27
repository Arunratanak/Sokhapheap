import { NextResponse } from "next/server";
import { sessionUser } from "@/server/auth/telegramLogin";
import { deleteRecord } from "@/server/db/records";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Delete one of the logged-in person's records. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/records/[id]">) {
  const who = await sessionUser(req);
  if (!who.ok) return NextResponse.json({ error: "unauthorized" }, { status: who.status });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const ok = await deleteRecord(who.telegramUserId, id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "unavailable" }, { status: 503 });
}
