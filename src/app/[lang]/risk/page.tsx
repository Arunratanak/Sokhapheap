import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { ComingSoon } from "@/components/ComingSoon";

// Placeholder until Phase 6.
export default async function RiskPage({ params }: PageProps<"/[lang]/risk">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  return <ComingSoon lang={lang} t={t} title={t.risk.title} />;
}
