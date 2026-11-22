import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let service: SupabaseClient | null = null;

/** Server-only client with the service role key (bypasses RLS). Returns null if not configured. */
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  service ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return service;
}

/** Public (anon) client — can only read facilities under RLS. */
export function getAnonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Reject after `ms` so a slow or unreachable database never blocks a user. */
export function withTimeout<T>(p: PromiseLike<T>, ms = 4000): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}
