import { ChevronDown, Info } from "lucide-react";

/**
 * "What does this mean?" disclosure for questions with medical words (e.g. blood pressure medicine).
 * Native <details>: works without JavaScript, with the keyboard and with screen readers.
 */
export function InfoTip({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <details className={`group rounded-xl border border-border bg-surface-1 text-label ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 font-medium text-secondary select-none hover:text-primary [&::-webkit-details-marker]:hidden">
        <Info aria-hidden size={16} className="shrink-0" />
        {label}
        <ChevronDown aria-hidden size={16} className="ml-auto transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="px-3 pt-0 pb-3 text-body text-primary">{children}</div>
    </details>
  );
}
