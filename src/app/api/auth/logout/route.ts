import { NextResponse } from "next/server";
import { logout } from "@/server/auth/telegramLogin";

/** Log out this browser: deletes the session given in the Authorization header. */
export async function POST(req: Request) {
  await logout(req);
  return NextResponse.json({ ok: true });
}
