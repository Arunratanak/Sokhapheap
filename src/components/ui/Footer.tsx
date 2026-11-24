import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { LogoMark } from "./Logo";
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
    <footer className="mt-auto border-t border-line bg-surface-2/60 print:hidden">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Link href={base} className="inline-flex items-center gap-2.5 self-start rounded-lg text-lg font-bold">
            <LogoMark size={32} />
            {t.common.appName}
          </Link>
          <p className="max-w-xs text-sm text-muted">{t.home.tagline}</p>
          <p className="text-xs text-muted">{t.common.disclaimer}</p>
        </div>
        <FooterCol title={t.footer.product} links={product} />
        <FooterCol title={t.footer.data} links={data} />
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t.footer.settings}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher current={lang} label={t.nav.language} />
            <ThemeToggle labels={{ toDark: t.nav.toDark, toLight: t.nav.toLight }} />
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:px-6">
          <p className="font-medium text-foreground/80">{t.footer.credit}</p>
          <p>{t.footer.dataNote}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-muted underline-offset-4 transition-colors hover:text-brand-strong hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
