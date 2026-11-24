"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "./Logo";

/**
 * Short loading animation (beating logo + three dots) with a message. It appears only if the wait lasts
 * longer than `delayMs`, so fast responses don't flash a loader. Announced politely to screen readers.
 * With "reduce motion" on, the global CSS rule stops the animation; the message still shows.
 */
export function LoadingState({ message, delayMs = 300, compact = false }: { message: string; delayMs?: number; compact?: boolean }) {
  const [visible, setVisible] = useState(delayMs === 0);
  useEffect(() => {
    if (delayMs === 0) return;
    const id = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-3 ${compact ? "py-2" : "flex-col py-12"}`}>
      {visible && (
        <>
          <span className="heartbeat inline-flex">
            <LogoMark size={compact ? 28 : 48} />
          </span>
          <span className={`flex items-center gap-2 font-medium ${compact ? "text-sm text-muted" : "text-lg"}`}>
            {message}
            <span aria-hidden className="inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="dot-bounce h-1.5 w-1.5 rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          </span>
        </>
      )}
    </div>
  );
}
