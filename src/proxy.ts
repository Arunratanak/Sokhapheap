import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale, LOCALE_COOKIE } from "@/i18n";

/** Sites allowed to call /api from the browser: the static GitHub Pages frontend. */
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? "https://arunratanak.github.io")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) return cors(request);

  // Redirect any path without a locale prefix to /km (default) or the saved choice.
  const first = pathname.split("/")[1] ?? "";
  if (hasLocale(first)) return;

  const saved = request.cookies.get(LOCALE_COOKIE)?.value ?? "";
  const locale = hasLocale(saved) ? saved : defaultLocale;
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

function cors(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || !CORS_ORIGINS.includes(origin)) return;
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    // Authorization: the "Log in with Telegram" session token (a bearer token, not a cookie, because the
    // Pages frontend and the Render API are on different sites).
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers });
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export const config = {
  // API routes (for CORS) plus pages; skip Next internals and static files (anything with a dot).
  matcher: ["/api/:path*", "/((?!api|_next|.*\\..*).*)"],
};
