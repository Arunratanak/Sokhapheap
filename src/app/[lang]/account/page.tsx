import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/i18n";
import { RecordsView } from "@/components/features/account/RecordsView";

export async function generateMetadata({ params }: PageProps<"/[lang]/account">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  // Personal page: keep it out of search results.
  return { title: `${getDictionary(lang).records.title.replaceAll("​", "")} · SokhaPheap`, robots: { index: false } };
}

/** "My records": log in with Telegram and see the results saved on the website and in the bot. */
export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <RecordsView lang={lang} t={getDictionary(lang)} />;
}
