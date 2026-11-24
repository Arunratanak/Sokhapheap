import { Reveal, RevealItem } from "./Reveal";

/** A home-page section: consistent width, vertical rhythm (8 px grid) and an optional heading block. */
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
    <section id={id} aria-labelledby={title && id ? `${id}-title` : undefined} className={`${tone === "tinted" ? "bg-surface-2/70" : ""} py-16 sm:py-24 ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {(eyebrow || title) && (
          <Reveal className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
            {eyebrow && <RevealItem><p className="eyebrow">{eyebrow}</p></RevealItem>}
            {title && (
              <RevealItem>
                <h2 id={id ? `${id}-title` : undefined} className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  {title}
                </h2>
              </RevealItem>
            )}
            {intro && <RevealItem><p className="mt-4 text-lg text-muted">{intro}</p></RevealItem>}
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}
