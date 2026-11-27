"use client";

import { useSyncExternalStore } from "react";
import { API_BASE } from "./api-base";

/**
 * "Log in with Telegram" session in the browser. The token is a bearer token kept in localStorage (not a
 * cookie): the GitHub Pages frontend and the Render API are on different sites, where cookies are blocked.
 * The person's first name is kept here only (the server stores just the Telegram ID).
 */
export interface AuthSession { token: string; name: string | null; expiresAt: string }

const KEY = "sokhapheap-auth";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: AuthSession | null = null;

function read(): AuthSession | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === cachedRaw) return cached; // same object for the same value (useSyncExternalStore needs that)
  cachedRaw = raw;
  try {
    const v = raw ? (JSON.parse(raw) as AuthSession) : null;
    cached = v && typeof v.token === "string" && new Date(v.expiresAt).getTime() > Date.now() ? v : null;
  } catch {
    cached = null;
  }
  return cached;
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && l(); // logged in / out in another tab
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function setAuth(session: AuthSession | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: stays logged out */
  }
  emit();
}

export function getAuth(): AuthSession | null {
  return typeof window === "undefined" ? null : read();
}

/** The current session, or null when logged out (always null during server rendering). */
export function useAuth(): AuthSession | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** fetch() to the API with the session token. A 401 means the session ended: the browser is logged out. */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = getAuth();
  const headers = new Headers(init.headers);
  if (session) headers.set("authorization", `Bearer ${session.token}`);
  const res = await fetch(API_BASE + path, { ...init, headers });
  if (res.status === 401 && session) setAuth(null);
  return res;
}

export async function logoutHere(): Promise<void> {
  await authFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  setAuth(null);
}
