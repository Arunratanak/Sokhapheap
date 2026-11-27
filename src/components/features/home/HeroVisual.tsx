import Link from "next/link";
import { ArrowRight, Droplet, Gauge, Wind } from "lucide-react";
import { IconHealthCheck, IconLabTube, IconTempleData } from "@/components/ui/BrandIcons";
import { StatusChip, StatusIcon, statusText, type Status } from "@/components/ui/Status";

/**
 * Example "product" cards for the hero slides. All values come from src/server/data/heroExamples.ts, which computes them
 * with the app's real scoring, lab and open-data logic (see heroExamples.test.ts). Status is always shown by
 * colour + icon + word, never colour alone. Cards stay neutral; status colour only on chips, icons and markers.
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

const STATUS: Record<Tone, Status> = { ok: "normal", caution: "borderline", danger: "out" };
const TILE_ICON = { diabetes: Droplet, bp: Gauge, tb: Wind } as const;

export function HeroVisual({ data, active = true }: { data: HeroVisualData; active?: boolean }) {
  const HeaderIcon = data.kind === "risk" ? IconHealthCheck : data.kind === "lab" ? IconLabTube : IconTempleData;
  return (
    <div className="mx-auto w-full max-w-md select-none lg:max-w-none">
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <span aria-hidden className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-secondary">
            <HeaderIcon size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-label font-semibold">{data.title}</p>
            <p className="text-caption text-secondary">{data.subtitle}</p>
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
      <div className="rounded-xl bg-surface-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-display font-semibold tabular-nums">{d.percentText}</p>
            <p className="mt-1 text-caption text-secondary">{d.caption}</p>
          </div>
          <StatusChip look={{ status: "normal" }} label={d.band} className="shrink-0" />
        </div>
        <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-status-normal" style={{ width: `${Math.max(d.percent, 2)}%` }} />
        </div>
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {d.tiles.map((tile) => {
          const status = STATUS[tile.tone];
          const Icon = TILE_ICON[tile.icon];
          return (
            <li key={tile.label} className="flex flex-col gap-1 rounded-xl bg-surface-2 p-3 text-caption wrap-normal">
              {/* wrap-normal: break between words only (a word is never split mid-way in these narrow tiles) */}
              <span className="flex items-center gap-1 font-medium text-secondary">
                <Icon aria-hidden size={14} className="shrink-0" />
                <span>{tile.label}</span>
              </span>
              {tile.value && <span className="text-label font-semibold tabular-nums">{tile.value}</span>}
              <span className={`mt-auto inline-flex items-center gap-1 font-medium ${statusText(status)}`}>
                <StatusIcon look={{ status }} className="shrink-0" />
                {tile.status}
              </span>
              {tile.next && <span className="text-secondary">{tile.next}</span>}
            </li>
          );
        })}
      </ul>
      <Link href={d.next.href} className="inline-flex items-center gap-1 self-start rounded-lg text-label font-medium text-gold hover:underline">
        {d.next.text}
        <ArrowRight aria-hidden size={16} />
      </Link>
    </div>
  );
}

function LabCard({ d }: { d: Extract<HeroVisualData, { kind: "lab" }> }) {
  return (
    <ul className="flex flex-col gap-2">
      {d.rows.map((r) => (
        <li key={r.name} className="flex items-start gap-3 rounded-xl bg-surface-2 px-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-label font-semibold">
              {r.name} · <span className="tabular-nums">{r.value}</span>
            </p>
            <p className="text-caption text-secondary">{r.note}</p>
          </div>
          <StatusChip look={{ status: STATUS[r.tone] }} label={r.pill} className="shrink-0" />
        </li>
      ))}
    </ul>
  );
}

function DataCard({ d, active }: { d: Extract<HeroVisualData, { kind: "data" }>; active: boolean }) {
  const max = Math.max(...d.bars.map((b) => b.km));
  return (
    <div className="flex flex-col gap-3">
      <figure aria-label={d.chartLabel} className="rounded-xl bg-surface-2 p-3">
        <figcaption className="mb-2 inline-flex items-center gap-2 text-caption font-medium">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-gold" />
          {d.highlight}
          <span className="sr-only"> — {d.chartLabel}</span>
        </figcaption>
        <ul className="flex h-36 items-end gap-1.5">
          {d.bars.map((b, i) => (
            <li
              key={b.name}
              tabIndex={0}
              aria-label={`${b.name}: ${b.kmText}`}
              className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1 rounded-lg"
            >
              {/* tooltip on hover / keyboard focus */}
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-lg border border-border bg-surface-1 px-2 py-1 text-micro whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
              >
                {b.name} · {b.kmText}
              </span>
              <span
                aria-hidden
                className={`w-full rounded-t-lg transition-[height] duration-300 ease-enter ${b.top ? "bg-gold" : "bg-surface-3"}`}
                style={{
                  height: active ? `${(b.km / max) * 82}%` : "0%",
                  transitionDelay: active ? `${i * 30}ms` : "0ms",
                }}
              />
              <span aria-hidden className="w-full truncate text-center text-micro text-secondary">{b.label}</span>
            </li>
          ))}
        </ul>
      </figure>
      {/* Phones: one row per stat (number + label side by side); wider screens: three columns. */}
      <ul className="grid gap-2 sm:grid-cols-3">
        {d.stats.map((s) => (
          <li key={s.label} className="flex items-baseline gap-2 rounded-xl border border-border p-3 sm:flex-col sm:items-start sm:gap-0">
            <span className="shrink-0 text-h3 font-semibold whitespace-nowrap tabular-nums">{s.value}</span>
            <span className="text-caption text-secondary">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
