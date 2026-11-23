import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { OrgDashboard } from "@/components/org/OrgDashboard";
import { provinces } from "@/lib/insights/planner";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OrgPage({ params }: PageProps<"/[lang]/org/[code]">) {
  const { lang, code } = await params;
  if (!hasLocale(lang) || !/^[A-Za-z0-9_-]{3,32}$/.test(code)) notFound();
  const t = getDictionary(lang);
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-2xl font-bold">{t.org.title}</h1>
      <OrgDashboard code={code} lang={lang} t={t} provinces={provinces()} />
    </div>
  );
}
