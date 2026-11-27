"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n";
import type { SavedRecord } from "@/domain/records";
import { MODULES } from "@/domain/modules/registry";
import type { Urgency } from "@/domain/modules/types";
import { LAB_RANGES } from "@/domain/scoring/labRanges";
import { authFetch, logoutHere, setAuth, useAuth } from "@/lib/client/auth";
import { fmtClient, toKhmerDigits } from "@/lib/client/util";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { LoadingState } from "@/components/ui/LoadingState";
import { TelegramLogin } from "./TelegramLogin";

// Colour + icon + words, as on the result pages.
const TONE = {
  ok: { bg: "var(--ok-bg)", fg: "var(--ok-fg)" },
  mild: { bg: "var(--lime-bg)", fg: "var(--lime-fg)" },
  caution: { bg: "var(--caution-bg)", fg: "var(--caution-fg)" },
  high: { bg: "var(--orange-bg)", fg: "var(--orange-fg)" },
  danger: { bg: "var(--danger-bg)", fg: "var(--danger-fg)" },
  neutral: { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)" },
} as const;
type Tone = keyof typeof TONE;
const URGENCY: Record<Urgency, { tone: Tone; icon: string }> = {
  red_flag: { tone: "danger", icon: "🚨" }, high: { tone: "danger", icon: "🔴" }, moderate: { tone: "caution", icon: "🟠" },
  low: { tone: "ok", icon: "🟢" }, incomplete: { tone: "neutral", icon: "⚪" },
};
const FINDRISC = {
  low: { tone: "ok", icon: "🟢" }, slightly_elevated: { tone: "mild", icon: "🟡" }, moderate: { tone: "caution", icon: "🟠" },
  high: { tone: "high", icon: "🔴" }, very_high: { tone: "danger", icon: "🔴" },
} as const;
const CVD = { "<5": FINDRISC.low, "5-10": FINDRISC.slightly_elevated, "10-20": FINDRISC.moderate, "20-30": FINDRISC.high, ">=30": FINDRISC.very_high } as const;
const LAB = { normal: { tone: "ok", icon: "✅" }, outside_range: { tone: "high", icon: "⚠️" }, could_not_read: { tone: "neutral", icon: "❔" } } as const;

function Row({ tone, icon, label, value }: { tone: Tone; icon: string; label: string; value: string }) {
  return (
    <li className="flex flex-col rounded-lg px-3 py-2" style={{ background: TONE[tone].bg, color: TONE[tone].fg }}>
      <span className="text-sm font-medium">{label}</span>
      <span className="font-semibold"><span aria-hidden>{icon}</span> {value}</span>
    </li>
  );
}

function RecordBody({ r, lang, t }: { r: SavedRecord; lang: Locale; t: Dictionary }) {
  const digits = (v: number) => (lang === "km" ? toKhmerDigits(v) : String(v));
  if (r.kind === "health_check") {
    const byId = new Map(MODULES.map((m) => [m.id, m]));
    return (
      <ul className="flex flex-col gap-2">
        {r.data.cards.map((c) => {
          const m = byId.get(c.moduleId);
          if (!m) return null;
          const u = URGENCY[c.urgency];
          const band = c.redFlag ? t.check.urgency.red_flag : c.band && c.band !== "unavailable" ? (m.bands[c.band]?.[lang] ?? "") : t.check.urgency[c.urgency];
          const score = c.score !== null ? ` · ${t.check.score}: ${digits(c.score)}${m.scoreUnit?.[lang] ?? ""}` : "";
          return <Row key={c.moduleId} tone={u.tone} icon={u.icon} label={m.title[lang]} value={band + score} />;
        })}
      </ul>
    );
  }
  if (r.kind === "risk") {
    const { findrisc: f, cvd } = r.data;
    const fs = FINDRISC[f.band];
    const cs = cvd.band ? CVD[cvd.band] : { tone: "neutral" as const, icon: "🩺" };
    return (
      <ul className="flex flex-col gap-2">
        <Row tone={fs.tone} icon={fs.icon} label={t.results.diabetesTitle} value={`${t.results.findriscBands[f.band]} · ${fmtClient(t.results.diabetesScore, { score: f.score }, lang)}`} />
        <Row tone={cs.tone} icon={cs.icon} label={t.results.heartTitle} value={cvd.band ? t.results.cvdBands[cvd.band] : t.results.cvdUnavailable[cvd.reason ?? "bp_unknown"]} />
        <li className="text-sm">👉 {t.results.nextSteps[r.data.nextStep]}</li>
      </ul>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {r.data.values.map((v, i) => {
        const s = LAB[v.flag];
        const name = v.testId ? LAB_RANGES[v.testId].name[lang] : v.printedName;
        const value = v.value === null ? "—" : `${lang === "km" ? toKhmerDigits(v.value) : v.value} ${v.unit ?? ""}`.trim();
        return <Row key={i} tone={s.tone} icon={s.icon} label={name} value={`${value} · ${t.lab.flags[v.flag]}${v.direction ? ` (${t.lab.direction[v.direction]})` : ""}`} />;
      })}
    </ul>
  );
}

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ok"; records: SavedRecord[] };

/** The "My records" page: log in with Telegram, then see, delete or delete all saved results (web and bot). */
export function RecordsView({ lang, t }: { lang: Locale; t: Dictionary }) {
  const r = t.records;
  const auth = useAuth();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const res = await authFetch("/api/records");
      if (res.status === 401) return setNotice(t.auth.sessionExpired); // authFetch logged out
      if (!res.ok) return setLoad({ kind: "error" });
      setLoad({ kind: "ok", records: (await res.json()).records });
    } catch {
      setLoad({ kind: "error" });
    }
  }, [t.auth.sessionExpired]);

  useEffect(() => {
    if (!auth) return;
    // Loading the records is the point of this effect (data from the API, not derived state).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [auth, refresh]);

  async function remove(id: string) {
    if (!window.confirm(r.deleteConfirm)) return;
    const res = await authFetch(`/api/records/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setLoad((l) => (l.kind === "ok" ? { kind: "ok", records: l.records.filter((x) => x.id !== id) } : l));
    else setNotice(t.common.error);
  }

  async function removeAll() {
    if (!window.confirm(r.deleteAllConfirm)) return;
    const res = await authFetch("/api/records", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setNotice(t.common.error);
    setAuth(null); // the server logged out every browser too
    setNotice(r.deletedAll);
  }

  const date = (iso: string) =>
    new Intl.DateTimeFormat(lang === "km" ? "km-KH" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Phnom_Penh" }).format(new Date(iso));

  if (!auth)
    return (
      <div className="flex flex-col gap-4 pt-2">
        <h1 className="text-2xl font-bold">{r.title}</h1>
        {notice && <p role="status" className="rounded-lg bg-warn-soft px-3 py-2">{notice}</p>}
        <p>{t.auth.intro}</p>
        <TelegramLogin t={t} />
      </div>
    );

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{r.title}</h1>
          <p className="text-sm text-muted">{auth.name ? fmtClient(t.auth.loggedInAs, { name: auth.name }, lang) : t.auth.loggedIn}</p>
        </div>
        <button className="btn-ghost text-sm" onClick={() => void logoutHere()}>
          <LogOut aria-hidden size={16} /> {t.auth.logout}
        </button>
      </div>
      <p className="text-muted">{r.intro}</p>
      {notice && <p role="status" className="rounded-lg bg-warn-soft px-3 py-2">{notice}</p>}

      {load.kind === "loading" && <LoadingState message={t.common.loading} />}
      {load.kind === "error" && (
        <div className="flex flex-col gap-2">
          <p role="alert">{t.common.error}</p>
          <button className="btn-secondary" onClick={() => void refresh()}>{t.common.tryAgain}</button>
        </div>
      )}
      {load.kind === "ok" && !load.records.length && (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line p-5">
          <p>{r.empty}</p>
          <Link href={`/${lang}/check`} className="btn-primary">{t.nav.check}</Link>
        </div>
      )}
      {load.kind === "ok" && load.records.length > 0 && (
        <ul className="flex flex-col gap-4">
          {load.records.map((rec) => (
            <li key={rec.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">{r.kinds[rec.kind]}</h2>
                  <p className="text-sm text-muted">{date(rec.createdAt)} · {r.channel[rec.channel]}</p>
                </div>
                <button className="btn-ghost min-h-10 px-2 text-sm" onClick={() => void remove(rec.id)} aria-label={`${r.delete}: ${r.kinds[rec.kind]}, ${date(rec.createdAt)}`}>
                  <Trash2 aria-hidden size={16} /> {r.delete}
                </button>
              </div>
              <RecordBody r={rec} lang={lang} t={t} />
            </li>
          ))}
        </ul>
      )}

      <Disclaimer text={t.common.disclaimer} />
      {load.kind === "ok" && load.records.length > 0 && (
        <button className="btn-ghost text-sm text-[var(--danger)]" onClick={() => void removeAll()}>
          <Trash2 aria-hidden size={16} /> {r.deleteAll}
        </button>
      )}
      <p className="text-xs text-muted">🔒 {t.auth.privacy}</p>
    </div>
  );
}
