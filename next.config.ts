import type { NextConfig } from "next";

/**
 * GITHUB_PAGES=true builds a static export of the frontend (see .github/workflows/pages.yml).
 * The /api routes keep running on Render; the browser reaches them via NEXT_PUBLIC_API_BASE.
 */
const pages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  ...(pages && {
    output: "export",
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
    trailingSlash: true,
    images: { unoptimized: true },
  }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
