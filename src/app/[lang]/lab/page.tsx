import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { ComingSoon } from "@/components/ComingSoon";

// Placeholder until Phase 8.
export default async function LabPage({ params }: PageProps<"/[lang]/lab">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  return <ComingSoon lang={lang} t={t} title={t.lab.title} />;
}
