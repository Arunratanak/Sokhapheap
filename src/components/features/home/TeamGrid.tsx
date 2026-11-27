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
    <Reveal as="ul" className={`grid gap-5 sm:grid-cols-2 ${compact ? "" : "lg:grid-cols-4"}`}>
      {TEAM.map((p) => (
        <RevealItem as="li" key={p.name.en}>
          <div className="card group h-full p-6 text-center transition-[transform,translate,scale,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-lg">
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute -inset-1 rounded-full opacity-0 blur-md transition-opacity duration-300 [background:var(--gradient)] group-hover:opacity-60" />
              {p.photo ? (
                <Image src={BASE_PATH + p.photo} alt={p.name[lang]} width={96} height={96} loading="lazy" className="relative h-24 w-24 rounded-full object-cover ring-4 ring-surface" />
              ) : (
                <span aria-hidden className="relative inline-flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold text-[#1c1917] ring-4 ring-surface [background:var(--gradient)]">
                  {initials(p.name.en)}
                </span>
              )}
            </div>
            <h3 className="mt-5 text-lg font-bold">{p.name[lang]}</h3>
            {p.role && <p className="text-sm font-medium text-brand-strong">{p.role[lang]}</p>}
            {p.bio && <p className="mt-2 text-sm text-muted">{p.bio[lang]}</p>}
            {p.links && p.links.length > 0 && (
              <ul className="mt-4 flex justify-center gap-2">
                {p.links.map((l) => {
                  const Icon = LINK_ICON[l.kind];
                  return (
                    <li key={l.href}>
                      <a href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`${p.name[lang]}: ${l.kind}`} className="ctrl h-9 w-9">
                        <Icon aria-hidden size={16} />
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
