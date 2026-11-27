import { Info } from "lucide-react";

// Required on every result screen (ground rule 6). Calm caption style (DESIGN.md §7): no warning box.
export function Disclaimer({ text }: { text: string }) {
  return (
    <p role="note" className="flex items-start gap-2 text-caption text-secondary">
      <Info aria-hidden size={16} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </p>
  );
}
