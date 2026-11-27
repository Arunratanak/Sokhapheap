import { BASE_PATH } from "@/lib/client/api-base";
import Image from "next/image";
import { Globe, Mail, Send } from "lucide-react";
import type { Locale } from "@/i18n";
import { TEAM } from "@/config/team";
import { Reveal, RevealItem } from "@/components/ui/Reveal";

const LINK_ICON = { email: Mail, telegram: Send, web: Globe } as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function TeamGrid({ lang, compact = false }: { lang: Locale; compact?: boolean }) {
  return (
    <Reveal as="ul" className={`grid gap-3 sm:grid-cols-2 ${compact ? "" : "lg:grid-cols-4"}`}>
      {TEAM.map((p) => (
        <RevealItem as="li" key={p.name.en}>
          <div className="card h-full p-5">
            {p.photo ? (
              <Image src={BASE_PATH + p.photo} alt={p.name[lang]} width={64} height={64} loading="lazy" className="h-16 w-16 rounded-full border border-border object-cover" />
            ) : (
              <span aria-hidden className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface-3 text-h3 font-semibold text-secondary">
                {initials(p.name.en)}
              </span>
            )}
            <h3 className="mt-4 text-h3 font-semibold">{p.name[lang]}</h3>
            {p.role && <p className="text-label text-secondary">{p.role[lang]}</p>}
            {p.bio && <p className="mt-2 text-body text-secondary">{p.bio[lang]}</p>}
            {p.links && p.links.length > 0 && (
              <ul className="mt-4 flex gap-2">
                {p.links.map((l) => {
                  const Icon = LINK_ICON[l.kind];
                  return (
                    <li key={l.href}>
                      <a href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`${p.name[lang]}: ${l.kind}`} className="ctrl">
                        <Icon aria-hidden size={20} />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </RevealItem>
      ))}
    </Reveal>
  );
}
