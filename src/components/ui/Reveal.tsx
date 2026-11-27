"use client";

import * as m from "motion/react-m";

// DESIGN.md §11: enter easing, 300 ms, a 12 px slide.
const EASE = [0.2, 0, 0, 1] as const;

/** Fades and slides its children in once, when scrolled into view. Children with `RevealItem` stagger. */
export function Reveal({
  children,
  className,
  stagger = 0.08,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  as?: "div" | "ul" | "ol" | "section";
}) {
  const Comp = m[as];
  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </Comp>
  );
}

export function RevealItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" }) {
  const Comp = m[as];
  return (
    <Comp
      className={className}
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
      }}
    >
      {children}
    </Comp>
  );
}
