import type { MetadataRoute } from "next";

// Prerendered at build time (also required by the static GitHub Pages export).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const paths = ["", "/risk", "/lab", "/map", "/insights", "/about"];
  return ["km", "en"].flatMap((lang) =>
    paths.map((p) => ({
      url: `${site}/${lang}${p}`,
      alternates: { languages: { km: `${site}/km${p}`, en: `${site}/en${p}` } },
    })),
  );
}
