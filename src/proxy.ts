import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale, LOCALE_COOKIE } from "@/lib/i18n";

// Redirect any path without a locale prefix to /km (default) or the saved choice.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (hasLocale(first)) return;

  const saved = request.cookies.get(LOCALE_COOKIE)?.value ?? "";
  const locale = hasLocale(saved) ? saved : defaultLocale;
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API routes, Next internals and static files (anything with a dot).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
