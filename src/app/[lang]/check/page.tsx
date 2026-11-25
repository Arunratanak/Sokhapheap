import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { previewAllowed, visibleModules } from "@/lib/modules/registry";
import { CheckFlow } from "@/components/check/CheckFlow";

export async function generateMetadata({ params }: PageProps<"/[lang]/check">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: `${getDictionary(lang).check.title.replaceAll("​", "")} · SokhaPheap` };
}

export default async function CheckPage({ params, searchParams }: PageProps<"/[lang]/check">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  // The clinician gate is enforced here, on the server: drafts only in localhost preview, or when
  // PUBLISH_DRAFT_MODULES is on (then the "not yet reviewed by a doctor" banner is shown).
  // The static GitHub Pages build has no request, so preview is always off there.
  const preview =
    process.env.GITHUB_PAGES !== "true" &&
    previewAllowed((await headers()).get("host"), (await searchParams).preview);
  const visible = visibleModules(preview);
  const allowed = visible.map((m) => m.id);
  const hasDrafts = visible.some((m) => m.status === "draft");

  if (!allowed.length) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <h1 className="text-2xl font-bold">{t.check.title}</h1>
        <p>{t.check.noneLive}</p>
        <Link href={`/${lang}/risk`} className="btn-primary text-center">❤️ {t.check.goRisk}</Link>
      </div>
    );
  }
  return <CheckFlow lang={lang} t={t} allowed={allowed} preview={preview} hasDrafts={hasDrafts} />;
}
