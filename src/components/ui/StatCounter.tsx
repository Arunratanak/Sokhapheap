import { formatCount } from "@/lib/format";

/**
 * A statistic. Shown as its final value: no count-up animation on health numbers (DESIGN.md §11).
 * Same props as before, so the pages that use it are unchanged.
 */
export function StatCounter({ value, lang, suffix = "", decimals = 0, className = "" }: { value: number; lang: "en" | "km"; suffix?: string; decimals?: number; className?: string }) {
  return <span className={`whitespace-nowrap tabular-nums ${className}`}>{formatCount(value, lang, decimals) + suffix}</span>;
}
