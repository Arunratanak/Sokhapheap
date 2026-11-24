import Link from "next/link";

/** Surface card. `interactive` adds the hover lift and gradient border glow (for cards that are links). */
export function Card({ children, className = "", interactive = false }: { children: React.ReactNode; className?: string; interactive?: boolean }) {
  return (
    <div
      className={`card relative p-6 ${
        interactive
          ? "group transition-[transform,translate,scale,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-lg before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:p-px before:opacity-0 before:transition-opacity before:duration-300 before:[background:var(--gradient)] before:[mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)] hover:before:opacity-100 focus-within:before:opacity-100"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Button-styled link. */
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
  const cls = { primary: "btn-primary", secondary: "btn-secondary", gradient: "btn-gradient", ghost: "btn-ghost" }[variant];
  return (
    <Link href={href} className={`${cls} ${className}`}>
      {children}
    </Link>
  );
}
