import { CircleAlert, CircleArrowDown, CircleArrowUp, CircleCheck, CircleDashed, Phone } from "lucide-react";

/**
 * Health status display (DESIGN.md §3.3): muted colour + Lucide icon + words, always all three.
 * The app's existing result values are only MAPPED onto these four looks; nothing is recalculated.
 */
export type Status = "normal" | "borderline" | "out" | "none";
export interface StatusLook {
  status: Status;
  /** Out of range: which side (arrow icon). */
  direction?: "up" | "down";
  /** The app already flags this as urgent (red flag): phone icon + pinned-card pattern. */
  urgent?: boolean;
}

const COLOR: Record<Status, string> = {
  normal: "text-status-normal",
  borderline: "text-status-borderline",
  out: "text-status-out",
  none: "text-secondary",
};
const BG: Record<Status, string> = {
  normal: "bg-status-normal-subtle",
  borderline: "bg-status-borderline-subtle",
  out: "bg-status-out-subtle",
  none: "bg-surface-2",
};

/** The Lucide icon for a status (DESIGN.md §3.3): check, alert, arrow up/down, dashed circle, or phone when urgent. */
export function StatusIcon({ look, size = 14, className = "" }: { look: StatusLook; size?: number; className?: string }) {
  const p = { "aria-hidden": true, size, className } as const;
  if (look.urgent) return <Phone {...p} />;
  if (look.status === "normal") return <CircleCheck {...p} />;
  if (look.status === "borderline") return <CircleAlert {...p} />;
  if (look.status === "out") return look.direction === "down" ? <CircleArrowDown {...p} /> : <CircleArrowUp {...p} />;
  return <CircleDashed {...p} />;
}
export const statusText = (s: Status) => COLOR[s];
export const statusBg = (s: Status) => BG[s];
/** CSS colour of a status, for SVG and inline styles. */
export const statusVar = (s: Status) => (s === "none" ? "var(--text-tertiary)" : `var(--status-${s})`);

// ---- mappings from the app's existing result values (display only)
export function lookFromUrgency(u: "red_flag" | "high" | "moderate" | "low" | "incomplete"): StatusLook {
  if (u === "red_flag") return { status: "out", urgent: true };
  if (u === "high") return { status: "out" };
  if (u === "moderate") return { status: "borderline" };
  if (u === "low") return { status: "normal" };
  return { status: "none" };
}
export function lookFromFindrisc(b: "low" | "slightly_elevated" | "moderate" | "high" | "very_high"): StatusLook {
  return { status: b === "low" ? "normal" : b === "high" || b === "very_high" ? "out" : "borderline" };
}
export function lookFromCvd(b: "<5" | "5-10" | "10-20" | "20-30" | ">=30"): StatusLook {
  return { status: b === "<5" ? "normal" : b === "20-30" || b === ">=30" ? "out" : "borderline" };
}
export function lookFromLab(flag: "normal" | "outside_range" | "could_not_read", direction?: "low" | "high" | null): StatusLook {
  if (flag === "normal") return { status: "normal" };
  if (flag === "outside_range") return { status: "out", direction: direction === "low" ? "down" : "up" };
  return { status: "none" };
}

/** Status chip: radius-sm, subtle tint, 14 px icon, label text. */
export function StatusChip({ look, label, className = "" }: { look: StatusLook; label: string; className?: string }) {
  return (
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-lg px-2 py-0.5 text-label font-medium ${BG[look.status]} ${COLOR[look.status]} ${className}`}>
      <StatusIcon look={look} className="shrink-0" />
      <span>{label}</span>
    </span>
  );
}

/**
 * Range bar (DESIGN.md §7, the signature component): track, reference-range zone, marker for the value.
 * Uses only the value and range the app already has; values off the shown scale are pinned to the edge
 * with an arrow. `ariaLabel` carries the full sentence (value, range, status).
 */
export function RangeBar({
  value, low, high, unit, look, ariaLabel, format = (n) => String(n),
}: {
  value: number;
  low: number | null;
  high: number | null;
  unit: string;
  look: StatusLook;
  ariaLabel: string;
  format?: (n: number) => string;
}) {
  if (low === null && high === null) return null;
  // Scale: the range in the middle of the track with 75 % of its width as margin on each side
  // (from 0 when there is no lower bound), so most real values land on the track, not pinned at an edge.
  const lo = low ?? 0;
  const hi = high ?? (low ?? 0) * 2;
  const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 1e-6);
  const min = low === null ? 0 : Math.max(0, lo - span * 0.75);
  const max = hi + span * 0.75;
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  const raw = pos(value);
  const off = raw < 0 ? "down" : raw > 100 ? "up" : null;
  const marker = Math.min(100, Math.max(0, raw));
  const zoneFrom = Math.max(0, pos(lo));
  const zoneTo = Math.min(100, pos(hi));
  const color = statusVar(look.status);

  return (
    <div role="img" aria-label={ariaLabel} className="pt-7 pb-8">
      <div className="relative h-1.5 rounded-full bg-surface-3">
        {/* Reference-range zone. A little stronger than the 10 % "-subtle" tint, which disappears on the surface-3 track. */}
        <div className="absolute inset-y-0 rounded-full bg-status-normal/30" style={{ left: `${zoneFrom}%`, width: `${Math.max(zoneTo - zoneFrom, 1)}%` }} />
        {/* the value, above its marker */}
        <span
          aria-hidden
          className="absolute -top-6 -translate-x-1/2 text-label font-semibold whitespace-nowrap tabular-nums text-primary"
          style={{ left: `${Math.min(92, Math.max(8, marker))}%` }}
        >
          {off === "down" && "‹ "}
          {format(value)} <span className="text-caption font-normal text-secondary">{unit}</span>
          {off === "up" && " ›"}
        </span>
        <span
          aria-hidden
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg"
          style={{ left: `${marker}%`, background: color }}
        />
        {/* range ticks below */}
        {low !== null && (
          <span aria-hidden className="absolute top-3 -translate-x-1/2 text-micro text-secondary tabular-nums" style={{ left: `${zoneFrom}%` }}>
            {format(low)}
          </span>
        )}
        {high !== null && (
          <span aria-hidden className="absolute top-3 -translate-x-1/2 text-micro text-secondary tabular-nums" style={{ left: `${zoneTo}%` }}>
            {format(high)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * AI output card (DESIGN.md §7): a normal card with a 2 px gold-muted left border, an "AI" eyebrow with a
 * small gold circle mark, the text in body type, and the existing note as a caption at the bottom.
 */
export function AiCard({ label, children, note, live = false }: { label: string; children: React.ReactNode; note?: string; live?: boolean }) {
  return (
    <section aria-live={live ? "polite" : undefined} className="card border-l-2 border-l-gold-muted p-5">
      <p className="flex items-center gap-2 text-caption text-secondary">
        <span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 border-gold" />
        {label}
      </p>
      <div className="mt-3 max-w-prose text-body">{children}</div>
      {note && <p className="mt-3 text-caption text-secondary">{note}</p>}
    </section>
  );
}

/** Skeleton lines in the shape of a short text block. */
export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton block h-4" style={{ width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}
