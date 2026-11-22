import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { listAreas } from "@/lib/facilities";
import { RiskFlow } from "@/components/risk/RiskFlow";

export default async function RiskPage({ params, searchParams }: PageProps<"/[lang]/risk">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const sp = await searchParams;
  const demo = sp.demo === "1";
  const org = typeof sp.org === "string" && /^[A-Za-z0-9_-]{3,32}$/.test(sp.org) ? sp.org : null;
  const provinces = listAreas().map((a) => a.province);

  return <RiskFlow lang={lang} t={getDictionary(lang)} demo={demo} orgCode={org} provinces={provinces} />;
}
