"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { formatCount } from "@/lib/format";

/**
 * Counts up from 0 to `value` once, when scrolled into view (ease-out, ~1.2 s).
 * Server-rendered with the final value so the number is right without JavaScript and for screen readers.
 */
export function StatCounter({ value, lang, suffix = "", decimals = 0, className = "" }: { value: number; lang: "en" | "km"; suffix?: string; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const started = useRef(false);

  // Before it scrolls into view, reset to 0 so the count-up starts from zero (no-op with reduced motion).
  useEffect(() => {
    if (!reduce && !started.current && !inView) setShown(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  useEffect(() => {
    if (!inView || reduce || started.current) return;
    started.current = true;
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(v),
    });
    return () => controls.stop();
  }, [inView, reduce, value]);

  const text = formatCount(shown, lang, decimals) + suffix;
  return (
    <span ref={ref} className={`whitespace-nowrap tabular-nums ${className}`}>
      <span aria-hidden>{text}</span>
      <span className="sr-only">{formatCount(value, lang, decimals) + suffix}</span>
    </span>
  );
}
