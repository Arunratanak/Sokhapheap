"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn-secondary min-h-11 shrink-0 print:hidden" onClick={() => window.print()}>
      <Printer aria-hidden size={20} /> {label}
    </button>
  );
}
