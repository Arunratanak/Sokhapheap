#!/usr/bin/env bash
# Static build of the frontend for GitHub Pages, written to ./out.
# Pages can only serve files, so the parts that need a server are removed from this build:
#   - src/app/api          → keeps running on Render; the browser calls it via NEXT_PUBLIC_API_BASE
#   - src/app/[lang]/org   → per-organisation pages (unknown codes, can't be prerendered); use Render
#   - src/proxy.ts         → locale redirect; replaced by a static index.html below
#   - opengraph-image.tsx  → rendered per request on Render (link previews use that URL)
# Run it in CI only (it deletes files from the checkout).
#
# Env: NEXT_PUBLIC_BASE_PATH (e.g. /Sokhapheap), NEXT_PUBLIC_API_BASE (Render URL),
#      NEXT_PUBLIC_SITE_URL (public Pages URL).
set -euo pipefail

rm -rf src/app/api "src/app/[lang]/org" src/proxy.ts "src/app/[lang]/opengraph-image.tsx"
# Tests import the API routes; they're type-checked and run by ci.yml instead.
rm -rf tests
find src -name '*.test.ts' -o -name '*.test.tsx' | xargs -r rm -f

GITHUB_PAGES=true npx next build

# "/" → default language (the server version does this in proxy.ts).
cat > out/index.html <<EOF
<!doctype html>
<meta charset="utf-8">
<title>SokhaPheap</title>
<meta http-equiv="refresh" content="0; url=${NEXT_PUBLIC_BASE_PATH:-}/km/">
<link rel="canonical" href="${NEXT_PUBLIC_BASE_PATH:-}/km/">
<a href="${NEXT_PUBLIC_BASE_PATH:-}/km/">SokhaPheap</a>
EOF

# Serve _next/ as-is (Jekyll would hide folders starting with "_").
touch out/.nojekyll
