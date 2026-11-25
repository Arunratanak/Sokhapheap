import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { listAreas } from "@/lib/facilities";
import { RiskFlow } from "@/components/risk/RiskFlow";
import { RiskFlowFromQuery } from "@/components/risk/RiskFlowFromQuery";

export default async function RiskPage({ params }: PageProps<"/[lang]/risk">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const provinces = listAreas().map((a) => a.province);

  // Query params (?demo, ?org) are read in the browser so this page stays static.
  // The fallback is the plain flow, which is what most visitors get anyway.
  return (
    <Suspense fallback={<RiskFlow lang={lang} t={t} demo={false} orgCode={null} provinces={provinces} />}>
      <RiskFlowFromQuery lang={lang} t={t} provinces={provinces} />
    </Suspense>
  );
}
