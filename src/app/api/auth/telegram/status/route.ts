import { NextResponse } from "next/server";
import { pollLogin } from "@/server/auth/telegramLogin";
import { badRequest, readJson } from "@/server/http/api";
import { clientIp, rateLimit } from "@/server/http/rateLimit";

/**
 * Poll a login started with /api/auth/telegram/start. POST body: { pollToken }
 * (POST, so the token never appears in URLs or access logs).
 */
export async function POST(req: Request) {
  if (!rateLimit(`login-poll:${clientIp(req)}`, 120, 60_000).ok)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const body = await readJson(req);
  if (!body.ok) return badRequest("Request body must be JSON");
  const r = await pollLogin((body.data as { pollToken?: unknown })?.pollToken as string);
  return NextResponse.json(r, { status: r.status === "error" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
