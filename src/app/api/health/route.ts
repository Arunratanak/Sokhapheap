import { NextResponse } from "next/server";
import { loadFacilities } from "@/server/data/facilities";
import { aiConfigured } from "@/server/ai/gemini";

/** Uptime check for Render's health check and external monitors. Never exposes secrets. */
export async function GET() {
  let facilities = 0;
  try {
    facilities = loadFacilities().length;
  } catch {
    return NextResponse.json({ ok: false, error: "facility data missing" }, { status: 500 });
  }
  return NextResponse.json(
    {
      ok: true,
      time: new Date().toISOString(),
      facilities,
      ai: aiConfigured(),
      db: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      bot: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
