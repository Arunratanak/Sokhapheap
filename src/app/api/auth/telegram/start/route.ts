import { NextResponse } from "next/server";
import { startLogin } from "@/server/auth/telegramLogin";
import { clientIp, rateLimit } from "@/server/http/rateLimit";

/** Start "Log in with Telegram": returns the bot link to open, the code to match, and a poll token. */
export async function POST(req: Request) {
  if (!rateLimit(`login-start:${clientIp(req)}`, 10, 10 * 60_000).ok)
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  const r = await startLogin();
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 503 });
  return NextResponse.json(
    { url: r.url, code: r.code, pollToken: r.pollToken, expiresAt: r.expiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
