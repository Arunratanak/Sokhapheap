"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Send } from "lucide-react";
import type { Dictionary } from "@/i18n";
import { API_BASE } from "@/lib/client/api-base";
import { setAuth } from "@/lib/client/auth";

type Stage =
  | { kind: "idle"; notice?: string }
  | { kind: "starting" }
  | { kind: "waiting"; url: string; code: string; pollToken: string; expiresAt: number };

const POLL_MS = 2500;

/**
 * "Log in with Telegram": the button opens the bot (t.me link) and the person confirms there.
 * Meanwhile this page shows the same 4-digit code and polls until the login is confirmed.
 */
export function TelegramLogin({ t, prompt, compact = false, onLoggedIn }: { t: Dictionary; prompt?: string; compact?: boolean; onLoggedIn?: () => void }) {
  const a = t.auth;
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const loggedIn = useEffectEvent(() => onLoggedIn?.());

  async function start() {
    setStage({ kind: "starting" });
    try {
      const res = await fetch(API_BASE + "/api/auth/telegram/start", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) return setStage({ kind: "idle", notice: res.status === 429 ? t.common.error : a.unavailable });
      setStage({ kind: "waiting", url: body.url, code: body.code, pollToken: body.pollToken, expiresAt: new Date(body.expiresAt).getTime() });
      // Try to open Telegram right away; if the browser blocks it, the "Open Telegram" button is there.
      window.open(body.url, "_blank", "noopener");
    } catch {
      setStage({ kind: "idle", notice: a.unavailable });
    }
  }

  // Poll while waiting, and right away when the person comes back from the Telegram app.
  useEffect(() => {
    if (stage.kind !== "waiting") return;
    const s = stage;
    let stopped = false;
    let busy = false;
    const poll = async () => {
      if (stopped || busy) return;
      if (Date.now() > s.expiresAt) return setStage({ kind: "idle", notice: a.expired });
      busy = true;
      try {
        const res = await fetch(API_BASE + "/api/auth/telegram/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pollToken: s.pollToken }),
        });
        const r = await res.json().catch(() => null);
        if (stopped || !r) return;
        if (r.status === "confirmed") {
          stopped = true;
          setAuth({ token: r.token, name: r.name ?? null, expiresAt: r.expiresAt });
          loggedIn();
        }
        else if (r.status === "denied") setStage({ kind: "idle", notice: a.denied });
        else if (r.status === "expired") setStage({ kind: "idle", notice: a.expired });
      } catch {
        /* offline for a moment: try again on the next tick */
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [stage, a.denied, a.expired]);

  if (stage.kind === "waiting") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm" aria-live="polite">
        <a href={stage.url} target="_blank" rel="noopener noreferrer" className="btn-primary">
          <Send aria-hidden size={18} />
          {a.openTelegram}
        </a>
        <div className="text-center">
          <p className="text-sm text-muted">{a.codeLabel}</p>
          <p className="font-mono text-3xl font-bold tracking-[0.3em]">{stage.code}</p>
        </div>
        <p className="text-sm">{a.codeHelp}</p>
        <p role="status" className="flex items-center gap-2 text-sm text-muted">
          <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand" />
          {a.waiting}
        </p>
        <button className="btn-ghost text-sm" onClick={() => setStage({ kind: "idle" })}>{a.cancel}</button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${compact ? "" : "rounded-2xl border border-line bg-surface p-4 shadow-sm"}`}>
      {prompt && <p>{prompt}</p>}
      {stage.kind === "idle" && stage.notice && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm">{stage.notice}</p>}
      <button className="btn-primary" onClick={start} disabled={stage.kind === "starting"}>
        <Send aria-hidden size={18} />
        {stage.kind === "starting" ? t.common.loading : a.button}
      </button>
      <p className="text-xs text-muted">🔒 {a.privacy}</p>
    </div>
  );
}
