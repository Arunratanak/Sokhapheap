import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";

export function ComingSoon({ lang, t, title }: { lang: Locale; t: Dictionary; title: string }) {
  return (
    <div className="flex flex-col gap-4 pt-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted">{t.common.comingSoon}</p>
      <Link href={`/${lang}`} className="font-medium text-brand-strong underline">
        ← {t.common.backHome}
      </Link>
    </div>
  );
}
