import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n";
import { LogoMark } from "../ui/Logo";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Footer({ lang, t, healthCheckLive = false }: { lang: Locale; t: Dictionary; healthCheckLive?: boolean }) {
  const base = `/${lang}`;
  const product = [
    { href: healthCheckLive ? `${base}/check` : `${base}/risk`, label: t.nav.check },
    { href: `${base}/lab`, label: t.nav.lab },
  ];
  const data = [
    { href: `${base}/insights`, label: t.nav.insights },
    { href: `${base}/about#data`, label: t.footer.allSources },
    { href: `${base}/about`, label: t.nav.about },
  ];
  return (
    <footer className="mt-auto border-t border-border bg-surface-1 print:hidden">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Link href={base} className="inline-flex items-center gap-3 self-start rounded-xl text-h3 font-semibold">
            <LogoMark size={32} />
            {t.common.appName}
          </Link>
          <p className="max-w-xs text-label text-secondary">{t.home.tagline}</p>
          <p className="text-caption text-secondary">{t.common.disclaimer}</p>
        </div>
        <FooterCol title={t.footer.product} links={product} />
        <FooterCol title={t.footer.data} links={data} />
        <div className="flex flex-col gap-3">
          <h2 className="text-label font-semibold">{t.footer.settings}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher current={lang} label={t.nav.language} />
            <ThemeToggle labels={{ toDark: t.nav.toDark, toLight: t.nav.toLight }} />
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-caption text-secondary sm:px-8">
          <p className="font-medium text-primary">{t.footer.credit}</p>
          <p>{t.footer.dataNote}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-label font-semibold">{title}</h2>
      <ul className="flex flex-col gap-2 text-label">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-secondary underline-offset-4 transition-colors duration-150 hover:text-primary hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
