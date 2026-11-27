import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inter, Kantumruy_Pro } from "next/font/google";
import { getDictionary, hasLocale, locales } from "@/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { THEME_SCRIPT } from "@/components/layout/ThemeToggle";
import { visibleModules } from "@/domain/modules/registry";
import "../globals.css";

// Fonts (DESIGN.md §4.1): Inter first, Khmer characters fall through to Kantumruy Pro. Both variable.
// Kantumruy Pro (Khmer) is preloaded. Inter is not, so Khmer pages on slow 3G don't download it up
// front; it arrives with the CSS (display: swap).
const khmer = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  variable: "--font-khmer",
  display: "swap",
});
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
  // Dark is the default theme (DESIGN.md §3, §13).
  themeColor: "#0e0d0b",
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
  const healthCheckLive = visibleModules(false).length > 0;

  return (
    <html lang={lang} data-theme="dark" suppressHydrationWarning className={`${khmer.variable} ${inter.variable} h-full antialiased`}>
      <head>
        {/* Applies the saved theme (dark by default) before the first paint: no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only z-60 rounded-xl bg-gold px-4 py-2 text-label font-semibold text-on-gold focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          {t.nav.skip}
        </a>
        <Navbar
          lang={lang}
          healthCheckLive={healthCheckLive}
          t={{
            appName: t.common.appName,
            home: t.nav.home, check: t.nav.check, lab: t.nav.lab, insights: t.nav.insights, about: t.nav.about,
            cta: t.nav.cta, openMenu: t.nav.openMenu, closeMenu: t.nav.closeMenu, main: t.nav.main, language: t.nav.language,
            toDark: t.nav.toDark, toLight: t.nav.toLight, theme: t.nav.theme,
            login: t.nav.login, account: t.nav.account,
          }}
        />
        {/* Phone-shaped column: 560 px max, 20 px side padding (32 px from tablet up). DESIGN.md §5. */}
        <main id="main" className="mx-auto flex w-full max-w-140 flex-1 flex-col px-5 pt-4 pb-12 sm:px-8">
          {children}
        </main>
        <Footer lang={lang} t={t} healthCheckLive={healthCheckLive} />
      </body>
    </html>
  );
}
