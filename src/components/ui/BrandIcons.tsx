/**
 * SokhaPheap's own duotone icon set (replaces generic line icons for the main features and sections).
 * Style: soft brand-tint fill + 1.8 px outline in the current text colour + a small gold accent.
 * Pure SVG primitives, decorative (aria-hidden): the text next to them carries the meaning.
 */
type P = { size?: number; className?: string };
const TINT = "color-mix(in oklab, var(--accent) 24%, transparent)";
const GOLD = "var(--gold-500)";

function Svg({ size = 28, className = "", children }: P & { children: React.ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

/** Health check: clipboard with a pulse line and a gold tick. */
export function IconHealthCheck(p: P) {
  return (
    <Svg {...p}>
      <rect x="6" y="6" width="20" height="22" rx="4" fill={TINT} />
      <rect x="11" y="3.5" width="10" height="5" rx="2" fill="var(--surface)" />
      <path d="M9.5 18h3l2-4 3 7 2-3h3" />
      <circle cx="24" cy="25" r="4.2" fill={GOLD} stroke="none" />
      <path d="M22.2 25l1.3 1.3 2.4-2.6" stroke="#1c1917" strokeWidth={1.5} />
    </Svg>
  );
}

/** Heart & diabetes risk: heart with a pulse line and a gold spark. */
export function IconHeartRisk(p: P) {
  return (
    <Svg {...p}>
      <path d="M16 27S4.5 20 4.5 12.2A6.2 6.2 0 0 1 16 9a6.2 6.2 0 0 1 11.5 3.2C27.5 20 16 27 16 27z" fill={TINT} />
      <path d="M8 16h4l2-3.5 3 6.5 2-3h5" />
      <circle cx="26" cy="6.5" r="2" fill={GOLD} stroke="none" />
      <path d="M26 2.5v1.2M26 9.3v1.2M22 6.5h1.2M28.8 6.5H30" stroke={GOLD} strokeWidth={1.4} />
    </Svg>
  );
}

/** Blood test explainer: test tube with liquid and a gold drop. */
export function IconLabTube(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 4h8M13.5 4v17a2.5 2.5 0 0 0 5 0V4" />
      <path d="M13.5 14h5v7a2.5 2.5 0 0 1-5 0z" fill={TINT} stroke="none" />
      <path d="M13.5 14h5" />
      <path d="M25 13.5c0 1.8-1.3 3-3 3s-3-1.2-3-3c0-1.6 3-5 3-5s3 3.4 3 5z" fill={GOLD} stroke="none" />
      <path d="M8 26.5h16" />
    </Svg>
  );
}

/** Open data for Cambodia: three-tower temple silhouette rising from data bars. */
export function IconTempleData(p: P) {
  return (
    <Svg {...p}>
      <path d="M16 4l2.2 5H20v4h-8V9h1.8z" fill={TINT} />
      <path d="M9 10.5l1.6 3.5H12v3H6v-3h1.4zM23 10.5l1.6 3.5H26v3h-6v-3h1.4z" fill={TINT} />
      <path d="M5 17h22" />
      <path d="M8 27v-5M13 27v-7M19 27v-9M24 27v-6" strokeWidth={2.4} />
      <path d="M19 27v-9" stroke={GOLD} strokeWidth={2.4} />
      <path d="M4 27.5h24" />
    </Svg>
  );
}

/** How it works: a path with three stops. */
export function IconPathSteps(p: P) {
  return (
    <Svg {...p}>
      <path d="M6 25c6 0 4-8 10-8s4-8 10-8" strokeDasharray="2.5 3" />
      <circle cx="6" cy="25" r="3" fill={TINT} />
      <circle cx="16" cy="17" r="3" fill={TINT} />
      <circle cx="26" cy="9" r="3.4" fill={GOLD} stroke="none" />
    </Svg>
  );
}

/** Data sources: stacked layers. */
export function IconLayers(p: P) {
  return (
    <Svg {...p}>
      <path d="M16 5l11 5.5-11 5.5L5 10.5z" fill={TINT} />
      <path d="M5 16l11 5.5L27 16" />
      <path d="M5 21.5L16 27l11-5.5" />
      <circle cx="16" cy="10.5" r="1.8" fill={GOLD} stroke="none" />
    </Svg>
  );
}

/** Limitations: a gentle "note" sign (rounded triangle) with a gold dot. */
export function IconCaution(p: P) {
  return (
    <Svg {...p}>
      <path d="M14.2 6.2a2 2 0 0 1 3.6 0l9.4 17.2A2 2 0 0 1 25.4 26H6.6a2 2 0 0 1-1.8-2.6z" fill={TINT} />
      <path d="M16 12v6" />
      <circle cx="16" cy="21.8" r="1.5" fill={GOLD} stroke="none" />
    </Svg>
  );
}

/** Roadmap: a signpost. */
export function IconSignpost(p: P) {
  return (
    <Svg {...p}>
      <path d="M16 4v24" />
      <path d="M16 7h9l3 3-3 3h-9z" fill={TINT} />
      <path d="M16 15H7l-3 3 3 3h9z" fill={GOLD} stroke="none" />
      <path d="M16 15H7l-3 3 3 3h9" />
      <path d="M11 28h10" />
    </Svg>
  );
}

/** Privacy: shield with a keyhole. */
export function IconShieldLock(p: P) {
  return (
    <Svg {...p}>
      <path d="M16 4l10 4v7c0 6.5-4.3 11-10 13-5.7-2-10-6.5-10-13V8z" fill={TINT} />
      <circle cx="16" cy="14.5" r="2.6" fill={GOLD} stroke="none" />
      <path d="M16 17v4.5" />
    </Svg>
  );
}

/** Team: two people. */
export function IconPeople(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="11" r="4.5" fill={TINT} />
      <path d="M4 26c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={TINT} />
      <circle cx="22.5" cy="10" r="3.5" fill={GOLD} stroke="none" />
      <path d="M22 17.5c3.6 0 6 2.8 6 7" />
    </Svg>
  );
}
