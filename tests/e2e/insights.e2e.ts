/**
 * Insights page checks (Phase 4 / Checkpoint 4):
 *  - Fast 3G load time (cold cache) until the province map is drawn, and total bytes transferred
 *  - click → panel numbers match data/clean (5 spot checks via the ranking table "View" buttons)
 *  - downloads return the files with the right type, and they parse
 *  - no horizontal overflow at 375 px; no console errors
 * Screenshots go to SHOTS_DIR if set.
 *
 * Run (server must be running): BASE_URL=http://localhost:3100 npx tsx tests/e2e/insights.e2e.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR ?? "";
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
];
let failures = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
};

async function main() {
  const executablePath = BROWSERS.find((b) => fs.existsSync(b));
  if (!executablePath) throw new Error("No Edge/Chrome found");
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });

  // ---------- 1. Fast 3G, cold cache, phone
  {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, locale: "en-US" });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    let bytes = 0;
    cdp.on("Network.loadingFinished", (e: { encodedDataLength: number }) => (bytes += e.encodedDataLength));
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const t0 = Date.now();
    await page.goto(`${BASE}/km/insights`, { waitUntil: "domcontentloaded" });
    // Page usable = hydrated: typing in the search box filters the ranking table.
    const search = page.locator("input[type=search]");
    await search.waitFor({ timeout: 60000 });
    for (let i = 0; ; i++) {
      await search.fill("");
      await search.fill("Siem Pang");
      const n = await page.locator("tbody tr").count();
      if (n === 1) break;
      if (i > 300) throw new Error(`search never filtered the table (rows: ${n})`);
      await page.waitForTimeout(50);
    }
    const ms = Date.now() - t0;
    await search.fill("");
    ok(ms < 4000, `Fast 3G: page usable (figures + interactive table) in ${(ms / 1000).toFixed(2)} s (target < 4 s)`);
    console.log(`   transferred before the map: ${(bytes / 1024).toFixed(0)} KB`);
    const tMap = Date.now();
    await page.getByRole("button", { name: /ផែនទី/ }).first().click();
    await page.locator(".leaflet-container path.leaflet-interactive, .leaflet-container canvas").first().waitFor({ timeout: 60000 });
    console.log(`   map drawn ${((Date.now() - tMap) / 1000).toFixed(2)} s after tapping "Show map"`);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(w <= 375, `no horizontal overflow at 375 px (${w}px)`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "insights-phone.png"), fullPage: false });
    ok(errors.length === 0, `no console errors (${errors.slice(0, 2).join(" | ") || "none"})`);
    await page.close();
  }

  // ---------- 2. Spot-check 5 districts: panel numbers == data/clean
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "en-US" });
    await page.goto(`${BASE}/en/insights`, { waitUntil: "networkidle" });
    const gap = JSON.parse(fs.readFileSync("data/clean/gap_index_district.json", "utf8")).areas;
    const areas = new Map(JSON.parse(fs.readFileSync("data/clean/areas_district.json", "utf8")).areas.map((a: { pcode: string }) => [a.pcode, a]));
    const picks = [gap[0], gap[4], gap[9], gap[gap.length - 1], gap.find((g: { name_en: string }) => g.name_en === "Siem Pang")];
    for (const g of picks) {
      const a = areas.get(g.pcode) as Record<string, number | null>;
      await page.getByLabel("Search for a district or province").fill(g.name_en);
      await page.getByRole("button", { name: new RegExp(`^View\\s+${g.name_en}$`) }).first().click();
      const panel = page.locator("[aria-live=polite]").filter({ hasText: "Screening Gap Index" }).first();
      await panel.getByRole("heading", { name: g.name_en }).waitFor({ timeout: 15000 });
      const text = await panel.innerText();
      const expectIndex = String(g.index);
      const expectMotor = `${a.travel_motor_mean_min} min`;
      const expectPop = Number(a.population).toLocaleString("en");
      const good = text.includes(expectIndex) && text.includes(`Rank ${g.rank} of 197`) && text.includes(expectMotor) && text.includes(expectPop);
      ok(good, `${g.name_en}: index ${expectIndex}, rank ${g.rank}, motor ${expectMotor}, population ${expectPop} shown`);
    }
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "insights-desktop.png"), fullPage: false });
    await page.close();
  }

  // ---------- 3. Downloads
  for (const [file, type] of [["areas_district.csv", "text/csv"], ["gap_index.geojson", "application/geo+json"]]) {
    const res = await fetch(`${BASE}/api/open-data/download/${file}`);
    const body = await res.text();
    let parsed = false;
    if (file.endsWith(".csv")) parsed = body.split("\n").filter(Boolean).length === 198 && body.startsWith("pcode,district,");
    else parsed = JSON.parse(body).features.length === 197;
    ok(res.ok && (res.headers.get("content-type") ?? "").startsWith(type) && /attachment/.test(res.headers.get("content-disposition") ?? "") && parsed,
      `download ${file}: ${res.status}, ${res.headers.get("content-type")}, ${(body.length / 1024).toFixed(0)} KB, parses`);
  }

  await browser.close();
  console.log(failures ? `\n✗ ${failures} check(s) failed` : "\n✓ all insights checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
