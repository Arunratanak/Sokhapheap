"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, CircleCheck } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n";
import type { RecordInput } from "@/domain/records";
import { authFetch, useAuth } from "@/lib/client/auth";
import { TelegramLogin } from "./TelegramLogin";

type State = "idle" | "login" | "saving" | "saved" | "failed";

/**
 * "Save to my records" under a result. Saving needs "Log in with Telegram"; logged-out people get the
 * login right here, and the result is saved as soon as they have confirmed in Telegram.
 */
export function SaveRecordButton({ lang, t, record }: { lang: Locale; t: Dictionary; record: RecordInput }) {
  const r = t.records;
  const auth = useAuth();
  const [state, setState] = useState<State>("idle");

  async function save() {
    setState("saving");
    try {
      const res = await authFetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(record),
      });
      setState(res.ok ? "saved" : res.status === 401 ? "login" : "failed");
    } catch {
      setState("failed");
    }
  }

  if (state === "saved")
    return (
      <p role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 font-semibold" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
        <span className="inline-flex items-center gap-2"><CircleCheck aria-hidden size={20} /> {r.saved}</span>
        <Link href={`/${lang}/account`} className="underline">{r.view} →</Link>
      </p>
    );

  // Logged in from here: save the result they asked to save right away.
  if (state === "login" && !auth) return <TelegramLogin t={t} prompt={r.saveLoginPrompt} onLoggedIn={() => void save()} />;

  return (
    <div className="flex flex-col gap-2">
      <button className="btn-secondary" onClick={() => (auth ? save() : setState("login"))} disabled={state === "saving"}>
        <Bookmark aria-hidden size={18} />
        {state === "saving" ? r.saving : r.save}
      </button>
      {state === "failed" && <p role="alert" className="text-sm text-[var(--danger)]">{r.saveFailed}</p>}
    </div>
  );
}
