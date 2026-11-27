// Required on every result screen (ground rule 6).
export function Disclaimer({ text }: { text: string }) {
  return (
    <p
      role="note"
      className="rounded-xl border border-warn-border bg-warn-soft px-4 py-3 text-sm font-medium"
    >
      ⚠️ {text}
    </p>
  );
}
