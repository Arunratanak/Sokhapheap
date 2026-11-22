/**
 * Walks the DEMO_SCRIPT path in a real browser at 375 px and times it:
 * demo risk check → results (disclaimer) → map with location DENIED (dropdown fallback, directions link)
 * → lab upload of a fixture (real AI if configured) → evaluated results (disclaimer).
 *
 * Run (server must be running): BASE_URL=http://localhost:3100 npx tsx tests/e2e/demo.e2e.ts
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
const DISCLAIMER = "នេះមិនមែនជាការធ្វើរោគវិនិច្ឆ័យទេ";

async function main() {
  const executablePath = BROWSERS.find((b) => fs.existsSync(b));
  if (!executablePath) throw new Error("No Edge/Chrome found");
  const browser = await chromium.launch({ executablePath, headless: true });
  // No geolocation permission granted → location is denied.
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const shot = async (name: string) => SHOTS && page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
  const t0 = Date.now();
  const lap = (label: string) => console.log(`✓ ${label} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const waitText = (re: RegExp, timeout: number) =>
    page.waitForFunction((src) => new RegExp(src).test(document.body.innerText.replaceAll("​", "")), re.source, { timeout });
  const norm = async () => (await page.locator("main").innerText()).replaceAll("\u200B", "");

  // 1. Demo risk check
  await page.goto(`${BASE}/km/risk?demo=1`);
  for (let i = 0; i < 13; i++) {
    await page.getByRole("button", { name: /បន្ទាប់|មើលលទ្ធផលរបស់ខ្ញុំ/ }).first().click();
    await page.waitForTimeout(150);
  }
  await page.getByRole("heading", { name: "លទ្ធផលរបស់អ្នក" }).waitFor({ timeout: 15000 });
  let text = await norm();
  if (!text.includes("ហានិភ័យខ្ពស់") || !text.includes("១៥")) throw new Error("demo should show High risk, score 15");
  if (!text.includes("១០% ដល់តិចជាង ២០%")) throw new Error("demo heart band should be 10–<20%");
  if (!text.includes(DISCLAIMER)) throw new Error("disclaimer missing on results");
  await waitText(/សរសេរដោយ AI|ការពន្យល់ស្តង់ដារ/, 45000);
  await shot("demo-1-results.png");
  lap("risk check → High risk 15/26, heart 10–<20%, disclaimer, explanation");

  // 2. Map — location denied → dropdown fallback
  await page.getByRole("link", { name: /ស្វែងរកកន្លែងព្យាបាល/ }).click();
  await page.getByRole("button", { name: /ប្រើទីតាំងរបស់ខ្ញុំ/ }).click();
  await waitText(/យើងមិនអាចយកទីតាំងរបស់អ្នកបានទេ/, 15000);
  await page.getByLabel("ខេត្ត/រាជធានី").selectOption("Phnom Penh");
  await page.getByLabel("ស្រុក/ខណ្ឌ").selectOption("Chamkar Mon");
  await page.getByRole("link", { name: /ផ្លូវទៅ/ }).first().waitFor({ timeout: 15000 });
  const href = await page.getByRole("link", { name: /ផ្លូវទៅ/ }).first().getAttribute("href");
  if (!href?.match(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=1[01]\.\d+,10[45]\.\d+$/)) throw new Error(`bad directions link ${href}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
  if (overflow > 375) throw new Error(`map page overflows (${overflow}px)`);
  await page.waitForTimeout(1500);
  await shot("demo-2-map.png");
  lap(`map: location denied → dropdown fallback → directions link OK (${href})`);

  // 3. Lab report
  await page.goto(`${BASE}/km/lab`);
  await page.locator("input[type=file]").setInputFiles(path.resolve(__dirname, "../fixtures/lab_reports/02_en_high_glucose.png"));
  await page.getByRole("heading", { name: "ពិនិត្យលេខ" }).waitFor({ timeout: 60000 });
  const rows = await page.locator("main li").count();
  await shot("demo-3-confirm.png");
  await page.getByRole("button", { name: "ពិនិត្យលទ្ធផលរបស់ខ្ញុំ" }).click();
  await page.getByRole("heading", { name: "តេស្តឈាមរបស់អ្នក" }).waitFor({ timeout: 15000 });
  text = await norm();
  if (!text.includes(DISCLAIMER)) throw new Error("disclaimer missing on lab results");
  const outside = (text.match(/ក្រៅកម្រិតធម្មតា/g) ?? []).length;
  await waitText(/សរសេរដោយ AI|ការពន្យល់ស្តង់ដារ/, 45000);
  await shot("demo-4-lab.png");
  lap(`lab: ${rows} rows read, ${outside} "outside range" mentions, disclaimer shown`);

  console.log(`\nTotal automated demo time: ${((Date.now() - t0) / 1000).toFixed(0)} s (target: < 180 s incl. talking)`);
  await browser.close();
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
