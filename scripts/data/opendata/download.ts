/**
 * Downloads every raw file of the open-data pipeline into data/raw/ (skips files that exist).
 * The first download date of each file is recorded in data/raw/opendata/downloads.json, so the
 * manifest (and every rebuild) stays identical until a file is re-downloaded on purpose.
 *
 * Run: npm run data:opendata:download   (add --force to re-download everything)
 *
 * Network notes: HDX/S3 downloads are flaky from some networks (IPv6). We prefer IPv4 and retry.
 */
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { DATASETS } from "./sources";

dns.setDefaultResultOrder("ipv4first");
const RAW = path.resolve(__dirname, "../../../data/raw");
const LOG = path.join(RAW, "opendata/downloads.json");
const force = process.argv.includes("--force");

type Log = Record<string, { downloaded: string; url: string }>;
const log: Log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, "utf8")) : {};

async function fetchWithRetry(url: string, tries = 6): Promise<Buffer> {
  let last: unknown;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(300_000), redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error("empty response");
      return buf;
    } catch (e) {
      last = e;
      const msg = (e as Error & { cause?: { code?: string } }).cause?.code ?? (e as Error).message;
      console.log(`   retry ${i}/${tries} (${msg})`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw last;
}

async function main() {
  let failed = 0;
  for (const ds of DATASETS) {
    for (const f of ds.files) {
      const dest = path.join(RAW, f.path);
      if (!f.url) {
        console.log(`${fs.existsSync(dest) ? "✓" : "✗ MISSING (run npm run data:download)"} ${f.path} (facility pipeline)`);
        if (!fs.existsSync(dest)) failed++;
        continue;
      }
      if (fs.existsSync(dest) && !force) {
        console.log(`✓ ${f.path} (cached)`);
        continue;
      }
      console.log(`↓ ${f.path}`);
      try {
        const buf = await fetchWithRetry(f.url);
        // Sanity checks so an HTML error page is never stored as data.
        if (f.path.endsWith(".tif") && !(buf.subarray(0, 2).toString() === "II" || buf.subarray(0, 2).toString() === "MM"))
          throw new Error("not a GeoTIFF");
        if (f.path.endsWith(".json")) JSON.parse(buf.toString("utf8"));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        log[f.path] = { downloaded: new Date().toISOString().slice(0, 10), url: f.url };
        fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + "\n");
        console.log(`  ✓ ${(buf.length / 1024).toFixed(0)} KB`);
      } catch (e) {
        failed++;
        console.log(`  ✗ FAILED: ${(e as Error).message}\n    Download manually from ${f.url}\n    and save it as data/raw/${f.path}`);
      }
    }
  }
  if (failed) {
    console.log(`\n${failed} file(s) missing — see above.`);
    process.exit(1);
  }
  console.log("\nAll raw files present.");
}

main();
