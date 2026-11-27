"use client";

import { usePathname } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/i18n";
import { BASE_PATH } from "@/lib/client/api-base";

export const LOCALE_STORAGE_KEY = "sokhapheap-lang";

/** Remember the chosen language (cookie for the proxy, localStorage as a backup). Runs on click only. */
function rememberLocale(lang: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, lang);
  } catch {
    /* storage blocked: the cookie still remembers it */
  }
}

/**
 * EN / ខ្មែរ segmented switch. Each language has its own URL (/en/..., /km/...), so links stay shareable
 * and <html lang> is always right. The choice is remembered in the existing cookie (read by the proxy
 * for the bare "/" URL) and in localStorage.
 */
export function LanguageSwitcher({ current, label, className = "" }: { current: Locale; label: string; className?: string }) {
  const pathname = usePathname() ?? `/${current}`;
  const options: { lang: Locale; text: string }[] = [
    { lang: "en", text: "EN" },
    { lang: "km", text: "ខ្មែរ" },
  ];

  return (
    <div role="group" aria-label={label} className={`inline-flex h-10 items-center rounded-full border border-line bg-surface p-1 text-sm font-semibold ${className}`}>
      {options.map((o) => {
        const active = o.lang === current;
        // Plain <a> (full reload so <html lang> updates), so the basePath has to be added by hand.
        const href = BASE_PATH + pathname.replace(/^\/(km|en)(?=\/|$)/, `/${o.lang}`);
        return (
          <a
            key={o.lang}
            href={href}
            lang={o.lang}
            hrefLang={o.lang}
            aria-current={active ? "true" : undefined}
            onClick={() => rememberLocale(o.lang)}
            className={`inline-flex h-8 min-w-11 items-center justify-center rounded-full px-2.5 transition-colors duration-200 ${
              active ? "bg-brand text-on-brand shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {o.text}
          </a>
        );
      })}
    </div>
  );
}
