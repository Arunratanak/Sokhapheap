import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/i18n";
import { LabFlow } from "@/components/features/lab/LabFlow";

export default async function LabPage({ params }: PageProps<"/[lang]/lab">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <LabFlow lang={lang} t={getDictionary(lang)} />;
}
