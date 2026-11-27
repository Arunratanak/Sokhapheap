import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { clientIp, rateLimit } from "./rateLimit";

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function zodError(e: ZodError) {
  return badRequest(
    "Invalid input",
    e.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  );
}

export async function readJson(req: Request): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    return { ok: true, data: await req.json() };
  } catch {
    return { ok: false };
  }
}

/** Per-IP limit for AI routes. Returns a 429 response when exceeded, otherwise null. */
export function limitAi(req: Request, route: string, limit = 10, windowMs = 60_000) {
  const r = rateLimit(`${route}:${clientIp(req)}`, limit, windowMs);
  if (r.ok) return null;
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(r.retryAfterS) } },
  );
}
