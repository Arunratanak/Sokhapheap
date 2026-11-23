/**
 * Map page load time on a throttled "Fast 3G" connection (Lighthouse preset: 562.5 ms RTT,
 * 1.6 Mbps down, 750 kbps up), cold cache. The page is list-first:
 *   1. controls usable (JS hydrated, the province picker opens)
 *   2. facility list shown after choosing Phnom Penh (no thinking time, so this is the page's own cost)
 * Pass = controls usable under 3 s. The list adds one API round trip (~0.6 s at 562 ms RTT),
 * and the interactive map is timed from the "Show map" tap until all markers are drawn; both printed.
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

  const t0 = Date.now();
  await page.goto(`${BASE}/km/map`, { waitUntil: "domcontentloaded" });
  // Hydrated once the "province / district" button actually opens the picker.
  const picker = page.locator("select").first();
  while (!(await picker.isVisible())) {
    await page.getByRole("button", { name: /ខេត្ត/ }).first().click({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(50);
  }
  const controls = Date.now() - t0;
  await picker.selectOption("Phnom Penh");
  await page.locator('a[href^="https://www.google.com/maps/dir/"]').first().waitFor({ timeout: 30000 });
  const list = Date.now() - t0;

  let facilitiesBytes = 0;
  page.on("response", async (r) => {
    if (r.url().includes("/api/facilities/all")) facilitiesBytes = Number(r.headers()["content-length"] ?? 0) || (await r.body()).length;
  });
  const tMap = Date.now();
  const allResponse = page.waitForResponse((r) => r.url().includes("/api/facilities/all"), { timeout: 30000 });
  await page.getByRole("button", { name: /ផែនទី/ }).click();
  await allResponse;
  await page.locator(".leaflet-container canvas").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(200); // markers drawn on next frame
  const map = Date.now() - tMap;

  const s = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
  console.log(`controls usable: ${s(controls)} · facility list (Phnom Penh): ${s(list)}`);
  console.log(`map after tapping "Show map": ${s(map)} · facilities payload: ${(facilitiesBytes / 1024).toFixed(0)} KB`);
  const pass = controls < 3000;
  console.log(pass ? "✓ page usable under 3 s" : "✗ page usable over 3 s");
  await browser.close();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
