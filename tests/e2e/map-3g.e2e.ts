/**
 * Map load time on a throttled "Fast 3G" connection (Lighthouse preset: 562.5 ms RTT,
 * 1.6 Mbps down, 750 kbps up), cold cache. Measures until all facility markers are drawn.
 *
 * Run (server must be running): BASE_URL=http://localhost:3100 npx tsx tests/e2e/map-3g.e2e.ts
 */
import fs from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
];

async function main() {
  const executablePath = BROWSERS.find((b) => fs.existsSync(b));
  if (!executablePath) throw new Error("No Edge/Chrome found");
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
  });

  let facilitiesBytes = 0;
  page.on("response", async (r) => {
    if (r.url().includes("/api/facilities/all")) facilitiesBytes = Number(r.headers()["content-length"] ?? 0) || (await r.body()).length;
  });

  const t0 = Date.now();
  const facilitiesResponse = page.waitForResponse((r) => r.url().includes("/api/facilities/all"), { timeout: 30000 });
  await page.goto(`${BASE}/km/map`, { waitUntil: "domcontentloaded" });
  const shell = Date.now() - t0;
  await facilitiesResponse;
  await page.locator(".leaflet-container canvas").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(200); // markers drawn on next frame
  const markers = Date.now() - t0;
  console.log(`page shell: ${(shell / 1000).toFixed(2)} s · map with all markers: ${(markers / 1000).toFixed(2)} s · facilities payload: ${(facilitiesBytes / 1024).toFixed(0)} KB (on the wire)`);
  console.log(markers < 3000 ? "✓ under 3 s" : "✗ over 3 s");
  await browser.close();
  process.exit(markers < 3000 ? 0 : 1);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
