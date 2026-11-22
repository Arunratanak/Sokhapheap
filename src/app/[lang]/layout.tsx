import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Noto_Sans_Khmer } from "next/font/google";
import { getDictionary, hasLocale, locales } from "@/lib/i18n";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import "../globals.css";

// One family (Noto Sans Khmer) covers Khmer and Latin — fewer font downloads on slow 3G.
const khmer = Noto_Sans_Khmer({
  subsets: ["khmer", "latin"],
  variable: "--font-khmer",
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
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const strip = (s: string) => s.replaceAll("​", "");
  return {
    metadataBase: new URL(site),
    title: strip(dict.meta.title),
    description: strip(dict.meta.description),
    alternates: { canonical: `/${lang}`, languages: { km: "/km", en: "/en" } },
    openGraph: {
      title: strip(dict.meta.title),
      description: strip(dict.meta.description),
      siteName: "SokhaPheap",
      locale: lang === "km" ? "km_KH" : "en_US",
      type: "website",
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport = { themeColor: "#0f766e", width: "device-width", initialScale: 1 };

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <html lang={lang} className={`${khmer.variable} h-full antialiased`}>
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
        <footer className="mx-auto w-full max-w-xl px-4 pb-6 text-sm text-muted">
          <a href={`/${lang}/about`} className="underline underline-offset-4">{dict.common.about}</a>
        </footer>
      </body>
    </html>
  );
}
