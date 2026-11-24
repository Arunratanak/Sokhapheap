import { Info } from "lucide-react";

/**
 * "What does this mean?" disclosure for questions with medical words (e.g. blood pressure medicine).
 * Native <details>: works without JavaScript, with the keyboard and with screen readers.
 */
export function InfoTip({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <details className={`group rounded-xl border border-line bg-surface-2/60 text-sm ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 font-medium text-brand-strong select-none [&::-webkit-details-marker]:hidden">
        <Info aria-hidden size={16} className="shrink-0" />
        {label}
        <span aria-hidden className="ml-auto text-muted transition-transform duration-200 group-open:rotate-180">▾</span>
      </summary>
      <div className="px-3 pt-0 pb-3 text-foreground">{children}</div>
    </details>
  );
}
