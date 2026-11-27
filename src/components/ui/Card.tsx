import Link from "next/link";

/**
 * Surface card (DESIGN.md §7): surface-1, 1 px border, radius-lg, 20 px padding. No gradients or glows.
 * `interactive` (cards that are links) only strengthens the border on hover / keyboard focus.
 */
export function Card({ children, className = "", interactive = false }: { children: React.ReactNode; className?: string; interactive?: boolean }) {
  return (
    <div
      className={`card relative p-5 ${
        interactive ? "group transition-colors duration-150 hover:border-border-strong focus-within:border-gold" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Button-styled link. ("gradient" is kept as a name; it now renders as the plain primary button.) */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "gradient" | "ghost";
  className?: string;
}) {
  const cls = { primary: "btn-primary", secondary: "btn-secondary", gradient: "btn-primary", ghost: "btn-ghost" }[variant];
  return (
    <Link href={href} className={`${cls} ${className}`}>
      {children}
    </Link>
  );
}
