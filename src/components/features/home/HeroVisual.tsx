import Link from "next/link";
import { ArrowRight, CircleCheck, Droplet, Gauge, OctagonAlert, TriangleAlert, Wind } from "lucide-react";
import { IconHealthCheck, IconLabTube, IconTempleData } from "@/components/ui/BrandIcons";

/**
 * Example "product" cards for the hero slides. All values come from src/server/data/heroExamples.ts, which computes them
 * with the app's real scoring, lab and open-data logic (see heroExamples.test.ts). Status is always shown by
 * colour + icon + word, never colour alone; the colour pairs are the theme's result tokens (AA in both themes).
 */
export type Tone = "ok" | "caution" | "danger";
export type HeroVisualData =
  | {
      kind: "risk";
      title: string;
      subtitle: string;
      percent: number;
      percentText: string;
      caption: string;
      band: string;
      tiles: { tone: Tone; icon: "diabetes" | "bp" | "tb"; label: string; value?: string; status: string; next?: string }[];
      next: { text: string; href: string };
    }
  | { kind: "lab"; title: string; subtitle: string; rows: { tone: Tone; name: string; value: string; note: string; pill: string }[] }
  | {
      kind: "data";
      title: string;
      subtitle: string;
      highlight: string;
      chartLabel: string;
      bars: { label: string; name: string; kmText: string; km: number; top: boolean }[];
      stats: { value: string; label: string }[];
    };

const TONE: Record<Tone, { bg: string; fg: string; Icon: typeof CircleCheck }> = {
  ok: { bg: "var(--ok-bg)", fg: "var(--ok-fg)", Icon: CircleCheck },
  caution: { bg: "var(--caution-bg)", fg: "var(--caution-fg)", Icon: TriangleAlert },
  danger: { bg: "var(--danger-bg)", fg: "var(--danger-fg)", Icon: OctagonAlert },
};
const TILE_ICON = { diabetes: Droplet, bp: Gauge, tb: Wind } as const;

export function HeroVisual({ data, active = true }: { data: HeroVisualData; active?: boolean }) {
  const HeaderIcon = data.kind === "risk" ? IconHealthCheck : data.kind === "lab" ? IconLabTube : IconTempleData;
  return (
    <div className="relative mx-auto w-full max-w-md select-none lg:max-w-none">
      {/* glow */}
      <div aria-hidden className="absolute inset-[8%] rounded-[2.5rem] opacity-60 blur-3xl [background:var(--gradient)] dark:opacity-30" />
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface/90 p-4 shadow-lg backdrop-blur sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span aria-hidden className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-surface-2 text-brand-strong ring-1 ring-line">
            <HeaderIcon size={28} />
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-snug font-semibold">{data.title}</p>
            <p className="text-xs text-muted">{data.subtitle}</p>
          </div>
        </div>
        {data.kind === "risk" && <RiskCard d={data} />}
        {data.kind === "lab" && <LabCard d={data} />}
        {data.kind === "data" && <DataCard d={data} active={active} />}
      </div>
    </div>
  );
}

function RiskCard({ d }: { d: Extract<HeroVisualData, { kind: "risk" }> }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl p-4" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-4xl leading-none font-extrabold tracking-tight">{d.percentText}</p>
            <p className="mt-1.5 text-xs font-medium">{d.caption}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold dark:bg-white/10">
            <CircleCheck aria-hidden size={14} />
            {d.band}
          </span>
        </div>
        <div aria-hidden className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div className="h-full rounded-full bg-current" style={{ width: `${Math.max(d.percent, 2)}%` }} />
        </div>
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {d.tiles.map((tile) => {
          const tone = TONE[tile.tone];
          const Icon = TILE_ICON[tile.icon];
          return (
            <li key={tile.label} className="flex flex-col gap-1 rounded-2xl p-2.5 text-xs" style={{ background: tone.bg, color: tone.fg }}>
              <span className="flex items-center gap-1 font-semibold">
                <Icon aria-hidden size={14} className="shrink-0" />
                <span className="leading-snug">{tile.label}</span>
              </span>
              {tile.value && <span className="font-medium">{tile.value}</span>}
              <span className="mt-auto inline-flex items-center gap-1 font-bold">
                <tone.Icon aria-hidden size={13} className="shrink-0" />
                {tile.status}
              </span>
              {tile.next && <span className="leading-snug opacity-90">{tile.next}</span>}
            </li>
          );
        })}
      </ul>
      <Link href={d.next.href} className="group inline-flex items-center gap-1 self-start rounded-lg text-xs font-semibold text-brand-strong hover:underline">
        {d.next.text}
        <ArrowRight aria-hidden size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

function LabCard({ d }: { d: Extract<HeroVisualData, { kind: "lab" }> }) {
  return (
    <ul className="flex flex-col gap-2">
      {d.rows.map((r) => {
        const tone = TONE[r.tone];
        return (
          <li key={r.name} className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5">
            <tone.Icon aria-hidden size={18} className="mt-0.5 shrink-0" style={{ color: tone.fg }} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">
                {r.name} · <span className="tabular-nums">{r.value}</span>
              </p>
              <p className="text-xs leading-snug text-muted">{r.note}</p>
            </div>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
              {r.pill}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function DataCard({ d, active }: { d: Extract<HeroVisualData, { kind: "data" }>; active: boolean }) {
  const max = Math.max(...d.bars.map((b) => b.km));
  return (
    <div className="flex flex-col gap-3">
      <figure aria-label={d.chartLabel} className="rounded-2xl bg-surface-2 p-3">
        <figcaption className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full [background:var(--gradient)]" />
          {d.highlight}
          <span className="sr-only"> — {d.chartLabel}</span>
        </figcaption>
        <ul className="flex h-36 items-end gap-1.5">
          {d.bars.map((b, i) => (
            <li
              key={b.name}
              tabIndex={0}
              aria-label={`${b.name}: ${b.kmText}`}
              className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1 rounded-md outline-offset-2"
            >
              {/* tooltip on hover / keyboard focus */}
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-background opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
              >
                {b.name} · {b.kmText}
              </span>
              <span
                aria-hidden
                className="w-full rounded-t-md transition-[height] duration-700 ease-out"
                style={{
                  height: active ? `${(b.km / max) * 82}%` : "0%",
                  transitionDelay: active ? `${120 + i * 70}ms` : "0ms",
                  background: b.top ? "var(--gradient)" : "color-mix(in oklab, var(--accent) 32%, transparent)",
                }}
              />
              <span aria-hidden className="w-full truncate text-center text-[10px] text-muted">{b.label}</span>
            </li>
          ))}
        </ul>
      </figure>
      {/* Phones: one row per stat (number + label side by side); wider screens: three columns. */}
      <ul className="grid gap-2 sm:grid-cols-3">
        {d.stats.map((s) => (
          <li key={s.label} className="flex items-baseline gap-2 rounded-xl border border-line p-2.5 sm:flex-col sm:items-start sm:gap-0.5">
            <span className="shrink-0 text-base leading-tight font-extrabold tracking-tight whitespace-nowrap text-brand-strong tabular-nums">{s.value}</span>
            <span className="text-[11px] leading-snug text-muted">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
