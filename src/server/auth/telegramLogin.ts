import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { getServiceClient, withTimeout } from "../db/supabase";

/**
 * "Log in with Telegram" by confirming in the bot (no Telegram widget, no BotFather /setdomain):
 *
 *  1. The website calls startLogin(): a login request with two random secrets is stored (hashed).
 *     - linkToken goes into the bot link  t.me/<bot>?start=login_<linkToken>
 *     - pollToken stays in the browser that started the login
 *  2. The person opens the link; the bot shows the 4-digit code (also shown on the website) and asks to confirm.
 *     confirmLogin() records their Telegram user ID on the request.
 *  3. The browser polls with pollToken; once confirmed it gets a session token (90 days) and the request is deleted.
 *
 * Only hashes of the tokens are stored, so a database leak does not expose working sessions.
 */

export const LOGIN_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const LOGIN_START_PREFIX = "login_";

const token = () => randomBytes(32).toString("base64url"); // 43 chars, fits Telegram's 64-char start parameter
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
export const isToken = (t: unknown): t is string => typeof t === "string" && TOKEN_RE.test(t);

let cachedUsername: string | null = null;
/** The bot's @username: TELEGRAM_BOT_USERNAME, or asked from Telegram once (getMe) and cached. */
export async function botUsername(): Promise<string | null> {
  const env = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();
  if (env) return env;
  if (cachedUsername) return cachedUsername;
  const tokenEnv = process.env.TELEGRAM_BOT_TOKEN;
  if (!tokenEnv) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${tokenEnv}/getMe`, { signal: AbortSignal.timeout(5000) });
    const body = (await res.json()) as { ok: boolean; result?: { username?: string } };
    cachedUsername = body.ok ? (body.result?.username ?? null) : null;
  } catch {
    cachedUsername = null;
  }
  return cachedUsername;
}

export type StartResult =
  | { ok: true; pollToken: string; code: string; url: string; expiresAt: string }
  | { ok: false; reason: "not_configured" | "error" };

export async function startLogin(now = Date.now()): Promise<StartResult> {
  const db = getServiceClient();
  const username = await botUsername();
  if (!db || !username) return { ok: false, reason: "not_configured" };
  const linkToken = token();
  const pollToken = token();
  const code = String(randomInt(0, 10_000)).padStart(4, "0");
  const expiresAt = new Date(now + LOGIN_TTL_MS).toISOString();
  try {
    // Housekeeping: drop expired requests and sessions (cheap, indexed).
    void db.from("login_requests").delete().lt("expires_at", new Date(now).toISOString()).then(() => {});
    void db.from("user_sessions").delete().lt("expires_at", new Date(now).toISOString()).then(() => {});
    const { error } = await withTimeout(
      db.from("login_requests").insert({ link_hash: hashToken(linkToken), poll_hash: hashToken(pollToken), code, expires_at: expiresAt }),
    );
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("startLogin:", (e as Error).message);
    return { ok: false, reason: "error" };
  }
  return { ok: true, pollToken, code, url: `https://t.me/${username}?start=${LOGIN_START_PREFIX}${linkToken}`, expiresAt };
}

/** For the bot: the pending request behind a start link, to show its code before confirming. */
export async function findPendingLogin(linkToken: string): Promise<{ code: string } | null> {
  const db = getServiceClient();
  if (!db || !isToken(linkToken)) return null;
  try {
    const { data } = await withTimeout(
      db.from("login_requests").select("code").eq("link_hash", hashToken(linkToken)).eq("status", "pending")
        .gt("expires_at", new Date().toISOString()).maybeSingle(),
    );
    return data ? { code: String(data.code) } : null;
  } catch {
    return null;
  }
}

/** For the bot: the person tapped Confirm (or Cancel). Returns false if the request expired or was already used. */
export async function answerLogin(linkToken: string, user: { id: number; firstName?: string }, confirm: boolean): Promise<boolean> {
  const db = getServiceClient();
  if (!db || !isToken(linkToken)) return false;
  try {
    const { data, error } = await withTimeout(
      db.from("login_requests")
        .update(confirm ? { status: "confirmed", telegram_user_id: user.id, first_name: user.firstName?.slice(0, 64) ?? null } : { status: "denied" })
        .eq("link_hash", hashToken(linkToken)).eq("status", "pending").gt("expires_at", new Date().toISOString())
        .select("id"),
    );
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  } catch (e) {
    console.error("answerLogin:", (e as Error).message);
    return false;
  }
}

export type PollResult =
  | { status: "pending" }
  | { status: "denied" | "expired" }
  | { status: "confirmed"; token: string; name: string | null; expiresAt: string }
  | { status: "error" };

/** For the website: has the person confirmed in Telegram yet? On success the request is consumed. */
export async function pollLogin(pollToken: string, now = Date.now()): Promise<PollResult> {
  const db = getServiceClient();
  if (!db) return { status: "error" };
  if (!isToken(pollToken)) return { status: "expired" };
  const pollHash = hashToken(pollToken);
  try {
    const { data: req } = await withTimeout(
      db.from("login_requests").select("status, expires_at").eq("poll_hash", pollHash).maybeSingle(),
    );
    if (!req) return { status: "expired" };
    if (req.status === "denied") {
      await db.from("login_requests").delete().eq("poll_hash", pollHash);
      return { status: "denied" };
    }
    if (req.status === "pending") return new Date(req.expires_at).getTime() < now ? { status: "expired" } : { status: "pending" };

    // Confirmed: claim it (delete … returning), so two polls at once can't both get a session.
    const { data: claimed, error } = await withTimeout(
      db.from("login_requests").delete().eq("poll_hash", pollHash).eq("status", "confirmed").select("telegram_user_id, first_name"),
    );
    if (error) throw new Error(error.message);
    const row = claimed?.[0];
    if (!row?.telegram_user_id) return { status: "expired" };
    const sessionToken = token();
    const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
    const ins = await withTimeout(
      db.from("user_sessions").insert({ token_hash: hashToken(sessionToken), telegram_user_id: row.telegram_user_id, expires_at: expiresAt }),
    );
    if (ins.error) throw new Error(ins.error.message);
    return { status: "confirmed", token: sessionToken, name: row.first_name ?? null, expiresAt };
  } catch (e) {
    console.error("pollLogin:", (e as Error).message);
    return { status: "error" };
  }
}

function bearer(req: Request): string | null {
  const m = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  return m && isToken(m[1]) ? m[1] : null;
}

export type SessionLookup = { ok: true; telegramUserId: number } | { ok: false; status: 401 | 503 };

/** Who is calling? From the `Authorization: Bearer <session token>` header. */
export async function sessionUser(req: Request): Promise<SessionLookup> {
  const t = bearer(req);
  if (!t) return { ok: false, status: 401 };
  const db = getServiceClient();
  if (!db) return { ok: false, status: 503 };
  try {
    const { data, error } = await withTimeout(
      db.from("user_sessions").select("telegram_user_id").eq("token_hash", hashToken(t)).gt("expires_at", new Date().toISOString()).maybeSingle(),
    );
    if (error) throw new Error(error.message);
    return data ? { ok: true, telegramUserId: Number(data.telegram_user_id) } : { ok: false, status: 401 };
  } catch {
    return { ok: false, status: 503 };
  }
}

/** Log out this browser (deletes its session). */
export async function logout(req: Request): Promise<void> {
  const t = bearer(req);
  const db = getServiceClient();
  if (!t || !db) return;
  await withTimeout(db.from("user_sessions").delete().eq("token_hash", hashToken(t))).catch(() => {});
}

/** Log out every browser of this person (used by "delete my records" and the bot's /logout). */
export async function logoutEverywhere(telegramUserId: number): Promise<boolean> {
  const db = getServiceClient();
  if (!db) return false;
  try {
    const { error } = await withTimeout(db.from("user_sessions").delete().eq("telegram_user_id", telegramUserId));
    return !error;
  } catch {
    return false;
  }
}
