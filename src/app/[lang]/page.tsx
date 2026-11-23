import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { Disclaimer } from "@/components/Disclaimer";
import { visibleModules } from "@/lib/modules/registry";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  // The multi-screening health check is listed only once a module is clinician-verified.
  const healthCheckLive = visibleModules(false).length > 0;

  return (
    <div className="flex flex-1 flex-col gap-6 pt-4">
      <section>
        <h1 className="text-2xl font-bold leading-snug">{t.home.tagline}</h1>
      </section>

      <nav className="flex flex-col gap-4">
        <Link
          href={`/${lang}/risk`}
          className="block rounded-2xl bg-brand px-5 py-5 text-white shadow-sm hover:bg-brand-strong"
        >
          <span className="block text-xl font-semibold">❤️ {t.home.checkRisk}</span>
          <span className="mt-1 block text-sm text-white/90">{t.home.checkRiskHint}</span>
        </Link>
        {healthCheckLive && (
          <Link
            href={`/${lang}/check`}
            className="block rounded-2xl border-2 border-brand bg-surface px-5 py-5 text-brand-strong shadow-sm hover:bg-brand-soft"
          >
            <span className="block text-xl font-semibold">🩺 {t.home.healthCheck}</span>
            <span className="mt-1 block text-sm text-muted">{t.home.healthCheckHint}</span>
          </Link>
        )}
        <Link
          href={`/${lang}/lab`}
          className="block rounded-2xl border-2 border-brand bg-surface px-5 py-5 text-brand-strong shadow-sm hover:bg-brand-soft"
        >
          <span className="block text-xl font-semibold">🩸 {t.home.explainLab}</span>
          <span className="mt-1 block text-sm text-muted">{t.home.explainLabHint}</span>
        </Link>
        <Link
          href={`/${lang}/map`}
          className="block rounded-2xl border-2 border-black/10 bg-surface px-5 py-4 shadow-sm hover:bg-brand-soft"
        >
          <span className="block text-lg font-semibold">📍 {t.home.findCare}</span>
          <span className="mt-1 block text-sm text-muted">{t.home.findCareHint}</span>
        </Link>
        <Link
          href={`/${lang}/insights`}
          className="block rounded-2xl border-2 border-black/10 bg-surface px-5 py-4 shadow-sm hover:bg-brand-soft"
        >
          <span className="block text-lg font-semibold">📊 {t.home.insights}</span>
          <span className="mt-1 block text-sm text-muted">{t.home.insightsHint}</span>
        </Link>
      </nav>

      <p className="text-sm text-muted">🔒 {t.home.privacy}</p>
      <div className="mt-auto">
        <Disclaimer text={t.common.disclaimer} />
      </div>
    </div>
  );
}
