/** Anonymous aggregate statistics for the organization dashboard. Groups under MIN_GROUP are hidden. */
export const MIN_GROUP = 5;

export const FINDRISC_BANDS = ["low", "slightly_elevated", "moderate", "high", "very_high"] as const;
export const CVD_BANDS = ["<5", "5-10", "10-20", "20-30", ">=30", "unknown"] as const;

/** A count, or null when the true count is between 1 and MIN_GROUP-1 (hidden for privacy). */
export type SafeCount = number | null;

export interface OrgStats {
  total: SafeCount;
  findrisc: Record<(typeof FINDRISC_BANDS)[number], SafeCount>;
  cvd: Record<(typeof CVD_BANDS)[number], SafeCount>;
  isDemo: boolean;
}

export function suppress(n: number): SafeCount {
  return n > 0 && n < MIN_GROUP ? null : n;
}

export function aggregate(rows: { findrisc_band: string; cvd_band: string | null }[], isDemo: boolean): OrgStats {
  const f = Object.fromEntries(FINDRISC_BANDS.map((b) => [b, 0])) as Record<(typeof FINDRISC_BANDS)[number], number>;
  const c = Object.fromEntries(CVD_BANDS.map((b) => [b, 0])) as Record<(typeof CVD_BANDS)[number], number>;
  for (const r of rows) {
    if (r.findrisc_band in f) f[r.findrisc_band as keyof typeof f]++;
    const cb = (r.cvd_band ?? "unknown") as keyof typeof c;
    if (cb in c) c[cb]++;
  }
  const map = <K extends string>(o: Record<K, number>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, suppress(v as number)])) as Record<K, SafeCount>;
  return { total: suppress(rows.length), findrisc: map(f), cvd: map(c), isDemo };
}
