"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Lock, LogOut, Trash2, TriangleAlert } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n";
import type { SavedRecord } from "@/domain/records";
import { MODULES } from "@/domain/modules/registry";
import { LAB_RANGES } from "@/domain/scoring/labRanges";
import { StatusChip, lookFromCvd, lookFromFindrisc, lookFromLab, lookFromUrgency, type StatusLook } from "@/components/ui/Status";
import { authFetch, logoutHere, setAuth, useAuth } from "@/lib/client/auth";
import { fmtClient, toKhmerDigits } from "@/lib/client/util";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { LoadingState } from "@/components/ui/LoadingState";
import { TelegramLogin } from "./TelegramLogin";

/** One result line: label, then status chip (colour + icon + words) and the value. Neutral row, no colour fill. */
function Row({ look, label, status, value }: { look: StatusLook; label: string; status: string; value?: string }) {
  return (
    <li className="flex flex-col gap-1 border-b border-border py-3 last:border-0">
      <span className="text-label text-secondary">{label}</span>
      <span className="flex flex-wrap items-center gap-2">
        <StatusChip look={look} label={status} />
        {value && <span className="text-body tabular-nums">{value}</span>}
      </span>
    </li>
  );
}

function RecordBody({ r, lang, t }: { r: SavedRecord; lang: Locale; t: Dictionary }) {
  const digits = (v: number) => (lang === "km" ? toKhmerDigits(v) : String(v));
  if (r.kind === "health_check") {
    const byId = new Map(MODULES.map((m) => [m.id, m]));
    return (
      <ul className="flex flex-col">
        {r.data.cards.map((c) => {
          const m = byId.get(c.moduleId);
          if (!m) return null;
          const band = c.redFlag ? t.check.urgency.red_flag : c.band && c.band !== "unavailable" ? (m.bands[c.band]?.[lang] ?? "") : t.check.urgency[c.urgency];
          const score = c.score !== null ? `${t.check.score}: ${digits(c.score)}${m.scoreUnit?.[lang] ?? ""}` : undefined;
          return <Row key={c.moduleId} look={lookFromUrgency(c.redFlag ? "red_flag" : c.urgency)} label={m.title[lang]} status={band} value={score} />;
        })}
      </ul>
    );
  }
  if (r.kind === "risk") {
    const { findrisc: f, cvd } = r.data;
    return (
      <ul className="flex flex-col">
        <Row look={lookFromFindrisc(f.band)} label={t.results.diabetesTitle} status={t.results.findriscBands[f.band]} value={fmtClient(t.results.diabetesScore, { score: f.score }, lang)} />
        {cvd.band
          ? <Row look={lookFromCvd(cvd.band)} label={t.results.heartTitle} status={t.results.cvdBands[cvd.band]} />
          : <Row look={{ status: "none" }} label={t.results.heartTitle} status={t.results.cvdUnavailable[cvd.reason ?? "bp_unknown"]} />}
        <li className="pt-3 text-body">
          <span className="block text-caption text-secondary">{t.results.nextStepTitle}</span>
          {t.results.nextSteps[r.data.nextStep]}
        </li>
      </ul>
    );
  }
  // Lab values keep Western digits (DESIGN.md §4.1). Saved records have no reference range, so no range bar here.
  // DESIGN-TODO: range bars need the reference range stored in the record (src/domain/records.ts).
  return (
    <ul className="flex flex-col">
      {r.data.values.map((v, i) => {
        const name = v.testId ? LAB_RANGES[v.testId].name[lang] : v.printedName;
        const value = v.value === null ? "—" : `${v.value} ${v.unit ?? ""}`.trim();
        const status = `${t.lab.flags[v.flag]}${v.direction ? ` · ${t.lab.direction[v.direction]}` : ""}`;
        return <Row key={i} look={lookFromLab(v.flag, v.direction)} label={name} status={status} value={value} />;
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
        <h1 className="text-h1 font-semibold">{r.title}</h1>
        {notice && <p role="status" className="card p-4 text-body">{notice}</p>}
        <p className="text-body text-secondary">{t.auth.intro}</p>
        <TelegramLogin t={t} />
      </div>
    );

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 font-semibold">{r.title}</h1>
          <p className="text-caption text-secondary">{auth.name ? fmtClient(t.auth.loggedInAs, { name: auth.name }, lang) : t.auth.loggedIn}</p>
        </div>
        <button className="btn-ghost" onClick={() => void logoutHere()}>
          <LogOut aria-hidden size={16} /> {t.auth.logout}
        </button>
      </div>
      <p className="text-body text-secondary">{r.intro}</p>
      {notice && <p role="status" className="card p-4 text-body">{notice}</p>}

      {load.kind === "loading" && <LoadingState message={t.common.loading} />}
      {load.kind === "error" && (
        <div className="card flex items-start gap-3 p-5" role="alert">
          <TriangleAlert aria-hidden size={20} className="mt-0.5 shrink-0 text-secondary" />
          <div className="flex flex-col gap-3">
            <p className="text-body">{t.common.error}</p>
            <button className="btn-secondary self-start" onClick={() => void refresh()}>{t.common.tryAgain}</button>
          </div>
        </div>
      )}
      {load.kind === "ok" && !load.records.length && (
        <div className="card flex flex-col items-center gap-3 p-5 text-center">
          <ClipboardList aria-hidden size={40} className="text-tertiary" />
          <p className="text-h3 font-semibold">{r.title}</p>
          <p className="text-body text-secondary">{r.empty}</p>
          <Link href={`/${lang}/check`} className="btn-primary w-full">{t.nav.check}</Link>
        </div>
      )}
      {load.kind === "ok" && load.records.length > 0 && (
        <ul className="flex flex-col gap-3">
          {load.records.map((rec) => (
            <li key={rec.id} className="card p-5">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-h3 font-semibold">{r.kinds[rec.kind]}</h2>
                  <p className="text-caption text-secondary">{date(rec.createdAt)} · {r.channel[rec.channel]}</p>
                </div>
                <button className="btn-destructive -mr-3" onClick={() => void remove(rec.id)} aria-label={`${r.delete}: ${r.kinds[rec.kind]}, ${date(rec.createdAt)}`}>
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
        <button className="btn-destructive self-start" onClick={() => void removeAll()}>
          <Trash2 aria-hidden size={16} /> {r.deleteAll}
        </button>
      )}
      <p className="flex items-start gap-2 text-caption text-secondary"><Lock aria-hidden size={16} className="mt-0.5 shrink-0" />{t.auth.privacy}</p>
    </div>
  );
}
