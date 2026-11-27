import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Camera, FileUp, Keyboard, SearchX, TriangleAlert } from "lucide-react";
import { getDictionary, hasLocale, type Locale } from "@/i18n";
import { AiCard, RangeBar, SkeletonLines, StatusChip, type StatusLook } from "@/components/ui/Status";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { InfoTip } from "@/components/ui/InfoTip";
import { Card } from "@/components/ui/Card";

/**
 * Dev-only design reference (DESIGN.md §0.3 step 2, §13): every token, component and status in
 * dark / light × English / Khmer. Not available in production builds (404), and removed from the
 * GitHub Pages build (scripts/ci/build_pages.sh).
 */
export const metadata: Metadata = { title: "Design tokens · SokhaPheap", robots: { index: false } };

const COLORS = [
  "bg", "surface-1", "surface-2", "surface-3", "border", "border-strong",
  "text-primary", "text-secondary", "text-tertiary",
  "gold", "gold-hover", "gold-muted", "gold-subtle", "on-gold",
  "status-normal", "status-borderline", "status-out",
  "status-normal-subtle", "status-borderline-subtle", "status-out-subtle",
];
const TYPE = [
  ["text-display", "Display 40/44 · 600", "font-semibold"],
  ["text-h1", "H1 28/34 · 600", "font-semibold"],
  ["text-h2", "H2 22/28 · 600", "font-semibold"],
  ["text-h3", "H3 18/24 · 600", "font-semibold"],
  ["text-body", "Body 16/24 · 400", ""],
  ["text-body", "Body strong 16/24 · 500", "font-medium"],
  ["text-label", "Label 14/20 · 500", "font-medium"],
  ["text-caption", "Caption 13/18 · 400", ""],
  ["text-micro", "Micro 12/16 · 500", "font-medium"],
] as const;
const RADII = [
  ["rounded-lg", "radius-sm 8"], ["rounded-xl", "radius-md 12"], ["rounded-2xl", "radius-lg 16"], ["rounded-3xl", "radius-xl 24"], ["rounded-full", "full"],
] as const;

function Panel({ theme, lang }: { theme: "dark" | "light"; lang: Locale }) {
  const t = getDictionary(lang);
  const looks: [StatusLook, string][] = [
    [{ status: "normal" }, t.lab.flags.normal],
    [{ status: "borderline" }, t.results.findriscBands.moderate],
    [{ status: "out", direction: "up" }, `${t.lab.flags.outside_range} · ${t.lab.direction.high}`],
    [{ status: "out", direction: "down" }, `${t.lab.flags.outside_range} · ${t.lab.direction.low}`],
    [{ status: "out", urgent: true }, t.check.urgency.red_flag],
    [{ status: "none" }, t.lab.flags.could_not_read],
  ];
  return (
    <div data-theme={theme} lang={lang} className="flex flex-col gap-8 rounded-3xl border border-border bg-bg p-5 text-primary sm:p-8">
      <p className="text-caption text-secondary">{theme} · {lang}</p>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-semibold">Colour</h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COLORS.map((c) => (
            <li key={c} className="flex items-center gap-2 text-caption">
              <span className="h-8 w-8 shrink-0 rounded-lg border border-border" style={{ background: `var(--${c})` }} />
              <code>--{c}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-semibold">Type</h2>
        {TYPE.map(([cls, label, weight]) => (
          <p key={label} className={`${cls} ${weight}`}>{label} · {t.common.appName} {t.results.title}</p>
        ))}
        <p className="text-h2 font-semibold tabular-nums">5.8 <span className="text-caption font-normal text-secondary">mmol/L</span></p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-semibold">Radius · spacing</h2>
        <div className="flex flex-wrap gap-3">
          {RADII.map(([cls, label]) => (
            <span key={cls} className={`inline-flex h-16 w-24 items-end bg-surface-2 p-2 text-micro text-secondary ${cls}`}>{label}</span>
          ))}
        </div>
        <div className="flex items-end gap-1">
          {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((s) => (
            <span key={s} className="block w-3 bg-gold-muted" style={{ height: s * 4 }} title={`${s * 4}px`} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-semibold">Buttons</h2>
        <button className="btn-primary">{t.lab.evaluate} <ArrowRight aria-hidden size={20} /></button>
        <button className="btn-secondary">{t.common.findCare}</button>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost">{t.common.back}</button>
          <button className="btn-destructive">{t.records.deleteAll}</button>
          <button className="btn-primary" disabled>{t.common.loading}</button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-semibold">Upload choices</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <button className="btn-secondary"><Camera aria-hidden size={20} />{t.lab.takePhoto}</button>
          <button className="btn-secondary"><FileUp aria-hidden size={20} />PDF</button>
          <button className="btn-secondary"><Keyboard aria-hidden size={20} />{t.lab.typeManually}</button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-semibold">Inputs</h2>
        <label className="flex flex-col gap-1 text-label font-medium">
          {t.lab.testName}
          <input className="field" defaultValue="HbA1c" />
        </label>
        <label className="flex flex-col gap-1 text-label font-medium">
          {t.lab.value}
          <input className="field border-status-borderline" inputMode="decimal" defaultValue="6.1" />
          <span className="flex items-center gap-1 text-caption text-status-borderline"><TriangleAlert aria-hidden size={14} />{t.lab.reasons.low_confidence}</span>
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-semibold">Status</h2>
        <div className="flex flex-wrap gap-2">
          {looks.map(([look, label]) => <StatusChip key={label} look={look} label={label} />)}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-semibold">Range bar</h2>
        <Card>
          <div className="flex items-start justify-between gap-2">
            <p className="text-h3 font-semibold">LDL</p>
            <StatusChip look={{ status: "out", direction: "up" }} label={t.lab.flags.outside_range} />
          </div>
          <RangeBar value={162} low={null} high={130} unit="mg/dL" look={{ status: "out", direction: "up" }} ariaLabel="LDL 162 mg/dL. Reference range below 130. Above range." />
        </Card>
        <Card>
          <div className="flex items-start justify-between gap-2">
            <p className="text-h3 font-semibold">HDL</p>
            <StatusChip look={{ status: "normal" }} label={t.lab.flags.normal} />
          </div>
          <RangeBar value={52} low={40} high={60} unit="mg/dL" look={{ status: "normal" }} ariaLabel="HDL 52 mg/dL. Reference range 40 to 60. In range." />
        </Card>
        <Card>
          <div className="flex items-start justify-between gap-2">
            <p className="text-h3 font-semibold">Fasting glucose</p>
            <StatusChip look={{ status: "out", direction: "up" }} label={t.lab.flags.outside_range} />
          </div>
          <RangeBar value={410} low={70} high={100} unit="mg/dL" look={{ status: "out", direction: "up" }} ariaLabel="Off-scale example" />
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-semibold">Cards</h2>
        <Card>
          <p className="eyebrow">{t.check.areas.heart}</p>
          <h3 className="mt-1 text-h3 font-semibold">{t.results.heartTitle}</h3>
          <p className="mt-2 text-body text-secondary">{t.results.nextSteps.healthy_habits}</p>
          <a href="#" className="mt-3 inline-flex items-center gap-1 text-label font-medium text-gold">{t.records.view} <ArrowRight aria-hidden size={16} /></a>
        </Card>
        <div className="card border-l-2 border-l-status-out p-5">
          <p className="flex items-center gap-2 text-h3 font-semibold"><StatusChip look={{ status: "out", urgent: true }} label={t.check.urgency.red_flag} /></p>
          <p className="mt-2">{t.check.urgentCard}</p>
        </div>
        <AiCard label={t.results.explanationTitle} note={t.results.aiNote}>
          <p>{t.results.nextSteps.glucose_test}</p>
        </AiCard>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-semibold">Loading · empty · error</h2>
        <div className="card p-5">
          <p className="text-body text-secondary">{t.common.explaining}</p>
          <div className="mt-3"><SkeletonLines /></div>
        </div>
        <div className="card flex flex-col items-center gap-2 p-5 text-center">
          <SearchX aria-hidden size={40} className="text-tertiary" />
          <p className="text-h3 font-semibold">{t.records.title}</p>
          <p className="text-secondary">{t.records.empty}</p>
        </div>
        <div className="card flex items-start gap-3 p-5" role="alert">
          <TriangleAlert aria-hidden size={20} className="mt-0.5 shrink-0 text-secondary" />
          <div className="flex flex-col gap-3">
            <p>{t.common.error}</p>
            <button className="btn-secondary self-start">{t.common.tryAgain}</button>
          </div>
        </div>
        <InfoTip label={t.common.whatIsThis}>{t.risk.bpMeds.info}</InfoTip>
        <Disclaimer text={t.common.disclaimer} />
      </section>
    </div>
  );
}

export default async function DesignPage({ params }: PageProps<"/[lang]/dev/design">) {
  const { lang } = await params;
  if (!hasLocale(lang) || process.env.NODE_ENV === "production") notFound();
  return (
    <div className="page-wide flex flex-col gap-6 pt-2">
      <h1 className="text-h1 font-semibold">Design tokens</h1>
      <p className="text-secondary">DESIGN.md reference: dark / light × English / Khmer.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel theme="dark" lang="en" />
        <Panel theme="light" lang="en" />
        <Panel theme="dark" lang="km" />
        <Panel theme="light" lang="km" />
      </div>
    </div>
  );
}
