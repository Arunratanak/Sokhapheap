"use client";

import { LazyMotion, MotionConfig } from "motion/react";

// Async: the animation features download after the page is interactive (keeps the 3G load budget).
const loadFeatures = () => import("./motionFeatures").then((m) => m.default);

/**
 * Loads Motion's small DOM-animation feature set lazily (components use `m.*` from "motion/react-m").
 * reducedMotion="user": transforms are skipped for people who turn on "reduce motion"; opacity fades stay.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
