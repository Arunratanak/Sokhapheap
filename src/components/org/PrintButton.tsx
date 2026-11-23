"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn-secondary min-h-11 shrink-0 text-sm print:hidden" onClick={() => window.print()}>
      🖨️ {label}
    </button>
  );
}
