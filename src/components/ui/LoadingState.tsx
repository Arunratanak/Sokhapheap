"use client";

import { useEffect, useState } from "react";
import { SkeletonLines } from "./Status";

/**
 * Loading state (DESIGN.md §7): skeleton lines in the shape of the content that is coming, plus the
 * existing progress message. It appears only if the wait lasts longer than `delayMs`, so fast responses
 * don't flash a loader. Announced politely to screen readers. Reduce-motion stops the pulse.
 */
export function LoadingState({ message, delayMs = 300, compact = false }: { message: string; delayMs?: number; compact?: boolean }) {
  const [visible, setVisible] = useState(delayMs === 0);
  useEffect(() => {
    if (delayMs === 0) return;
    const id = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  return (
    <div role="status" aria-live="polite" className={`flex flex-col gap-3 ${compact ? "py-2" : "py-8"}`}>
      {visible && (
        <>
          <p className="text-body text-secondary">{message}</p>
          <SkeletonLines lines={compact ? 2 : 4} />
        </>
      )}
    </div>
  );
}
