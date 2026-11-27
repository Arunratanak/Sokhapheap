import { Reveal, RevealItem } from "./Reveal";

/** A home-page section: consistent width, vertical rhythm (4 px grid) and an optional heading block. */
export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  className = "",
  tone = "plain",
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  intro?: string;
  children: React.ReactNode;
  className?: string;
  tone?: "plain" | "tinted";
}) {
  return (
    <section
      id={id}
      aria-labelledby={title && id ? `${id}-title` : undefined}
      className={`${tone === "tinted" ? "border-y border-border bg-surface-1" : ""} py-16 sm:py-24 ${className}`}
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {(eyebrow || title) && (
          <Reveal className="mb-10 max-w-2xl sm:mb-12">
            {eyebrow && <RevealItem><p className="eyebrow">{eyebrow}</p></RevealItem>}
            {title && (
              <RevealItem>
                <h2 id={id ? `${id}-title` : undefined} className="mt-2 text-h1 font-semibold text-balance">
                  {title}
                </h2>
              </RevealItem>
            )}
            {intro && <RevealItem><p className="mt-3 text-body text-secondary">{intro}</p></RevealItem>}
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}
