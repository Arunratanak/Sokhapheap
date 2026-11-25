import type { MetadataRoute } from "next";

// Prerendered at build time (also required by the static GitHub Pages export).
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/km/org/", "/en/org/"] }], sitemap: `${site}/sitemap.xml` };
}
