import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Kantumruy_Pro, Noto_Sans_Khmer } from "next/font/google";
import { getDictionary, hasLocale, locales } from "@/lib/i18n";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import "../globals.css";

// Noto Sans Khmer for Khmer body text; Kantumruy Pro covers Latin + Khmer headings.
const khmer = Noto_Sans_Khmer({
  subsets: ["khmer"],
  variable: "--font-khmer",
  display: "swap",
});
const latin = Kantumruy_Pro({
  subsets: ["latin", "khmer"],
  variable: "--font-latin",
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return { title: dict.meta.title, description: dict.meta.description };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <html lang={lang} className={`${khmer.variable} ${latin.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-3">
          <a href={`/${lang}`} className="text-xl font-bold text-brand-strong">
            {dict.common.appName}
          </a>
          <LanguageSwitch current={lang} label={dict.common.switchLanguage} />
        </header>
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-8">
          {children}
        </main>
      </body>
    </html>
  );
}
