import { NextResponse } from "next/server";
import { webhookCallback } from "grammy";
import { timingSafeEqual } from "node:crypto";
import { getBot } from "@/lib/bot/bot";

function secretOk(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const got = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Telegram webhook. Rejects any request without the correct secret token header. */
export async function POST(req: Request) {
  if (!secretOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const bot = getBot();
  if (!bot) return NextResponse.json({ error: "bot not configured" }, { status: 503 });
  const handle = webhookCallback(bot, "std/http", { secretToken: process.env.TELEGRAM_WEBHOOK_SECRET, timeoutMilliseconds: 55_000 });
  return handle(req);
}
