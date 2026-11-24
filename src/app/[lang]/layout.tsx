import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inter, Noto_Sans_Khmer } from "next/font/google";
import { getDictionary, hasLocale, locales } from "@/lib/i18n";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { THEME_SCRIPT } from "@/components/ui/ThemeToggle";
import "../globals.css";

// Khmer pages: Noto Sans Khmer (covers Khmer and Latin) is the main font and is preloaded.
const khmer = Noto_Sans_Khmer({
  subsets: ["khmer", "latin"],
  variable: "--font-khmer",
  display: "swap",
});
// English pages: Inter. Not preloaded, so Khmer pages on slow 3G never download it up front;
// on English pages it is the first font in the stack and loads with the CSS.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
  preload: false,
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

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffbf5" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0d0b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);

  return (
    <html lang={lang} data-theme="light" suppressHydrationWarning className={`${khmer.variable} ${inter.variable} h-full antialiased`}>
      <head>
        {/* Applies the saved (or system) theme before the first paint: no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only z-[60] rounded-lg bg-brand px-4 py-2 font-semibold text-on-brand focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          {t.nav.skip}
        </a>
        <Navbar
          lang={lang}
          t={{
            appName: t.common.appName,
            home: t.nav.home, check: t.nav.check, lab: t.nav.lab, map: t.nav.map, insights: t.nav.insights, about: t.nav.about,
            cta: t.nav.cta, openMenu: t.nav.openMenu, closeMenu: t.nav.closeMenu, main: t.nav.main, language: t.nav.language,
            toDark: t.nav.toDark, toLight: t.nav.toLight, theme: t.nav.theme,
          }}
        />
        <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-4 pb-12">
          {children}
        </main>
        <Footer lang={lang} t={t} />
      </body>
    </html>
  );
}
