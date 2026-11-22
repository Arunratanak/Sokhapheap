"use client";

import { usePathname } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export function LanguageSwitch({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname() ?? `/${current}`;
  const target: Locale = current === "km" ? "en" : "km";
  const href = pathname.replace(/^\/(km|en)(?=\/|$)/, `/${target}`);

  return (
    <a
      href={href}
      lang={target}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=31536000; samesite=lax`;
      }}
      className="rounded-full border border-brand px-4 py-2 text-sm font-medium text-brand-strong hover:bg-brand-soft"
    >
      {label}
    </a>
  );
}
