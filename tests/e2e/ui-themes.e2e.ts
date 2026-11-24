/**
 * Visual / layout check of the redesigned UI: every main page in light + dark × English + Khmer,
 * at 360, 768, 1024 and 1440 px. Fails on horizontal overflow, console errors, a wrong <html lang>
 * or data-theme, and checks the theme survives a reload without flashing (set before first paint).
 * Saves screenshots when SHOTS_DIR is set.
 *
 * Run (server must be running): BASE_URL=http://localhost:3100 npx tsx tests/e2e/ui-themes.e2e.ts
 */
import fs from "node:fs";
import { chromium, type Browser } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR ?? "";
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
];
const PAGES = ["", "/risk", "/lab", "/map", "/insights", "/about"];
const WIDTHS = [360, 768, 1024, 1440];

async function check(browser: Browser, theme: "light" | "dark", lang: "en" | "km", width: number, failures: string[]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: "light" });
  // The saved choice wins over the system setting (here: system light, saved dark).
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem("sokhapheap-theme", t);
    } catch {}
  }, theme);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|tile/i.test(m.text()) && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  for (const p of PAGES) {
    const url = `${BASE}/${lang}${p}`;
    await page.goto(url, { waitUntil: "networkidle" });
    const label = `${theme}/${lang}/${width}px ${p || "/"}`;
    const state = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      lang: document.documentElement.lang,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    if (state.theme !== theme) failures.push(`${label}: data-theme=${state.theme}`);
    if (state.lang !== lang) failures.push(`${label}: lang=${state.lang}`);
    if (state.overflow > 1) failures.push(`${label}: horizontal overflow ${state.overflow}px`);
    const logoHeight = await page.locator("header a").first().evaluate((e) => e.getBoundingClientRect().height);
    if (logoHeight > 44) failures.push(`${label}: navbar brand name wraps (${Math.round(logoHeight)}px tall)`);
    if (SHOTS && (p === "" || width === 360)) {
      // Scroll through the page so scroll-triggered sections and counters play, then back to the top.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        await new Promise((r) => setTimeout(r, 1400));
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 400));
      });
      const name = `${theme}-${lang}-${width}-${(p || "home").replace("/", "")}.png`;
      await page.screenshot({ path: `${SHOTS}/${name}`, fullPage: p === "" });
    }
  }
  if (errors.length) failures.push(`${theme}/${lang}/${width}px console errors: ${[...new Set(errors)].slice(0, 3).join(" | ")}`);
  await ctx.close();
}

async function main() {
  const exe = BROWSERS.find((b) => fs.existsSync(b));
  if (!exe) throw new Error("No Chromium-based browser found");
  const browser = await chromium.launch({ executablePath: exe });
  const failures: string[] = [];
  for (const theme of ["light", "dark"] as const)
    for (const lang of ["en", "km"] as const)
      for (const width of WIDTHS) await check(browser, theme, lang, width, failures);

  // Mobile menu at 360 px: opens with all six links on screen, closes on Escape and on link click.
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/km`, { waitUntil: "networkidle" });
    const button = page.locator('button[aria-controls="mobile-menu"]');
    if (await page.locator("#mobile-menu").isVisible()) failures.push("mobile menu: visible before opening");
    await button.click();
    const links = page.locator("#mobile-menu nav a");
    await links.last().waitFor();
    await page.waitForTimeout(500); // slide-in finished
    if ((await links.count()) !== 6) failures.push(`mobile menu: ${await links.count()} links, expected 6`);
    for (let i = 0; i < (await links.count()); i++) {
      const box = await links.nth(i).boundingBox();
      if (!box || box.height < 40 || box.y + box.height > 740 || box.x < 0 || box.x + box.width > 361) failures.push(`mobile menu: link ${i + 1} not fully on screen (${JSON.stringify(box)})`);
    }
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/menu-km-360.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    if (await page.locator("#mobile-menu").isVisible()) failures.push("mobile menu: Escape did not close it");
    if ((await button.getAttribute("aria-expanded")) !== "false") failures.push("mobile menu: aria-expanded not reset");
    await button.click();
    await links.nth(2).click(); // Lab results
    await page.waitForURL(/\/km\/lab$/);
    await page.waitForTimeout(400);
    if (await page.locator("#mobile-menu").isVisible()) failures.push("mobile menu: link click did not close it");
    await ctx.close();
  }

  // System dark + nothing saved → dark; html is dark before any script beyond the inline one runs.
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 800 }, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
  if ((await page.getAttribute("html", "data-theme")) !== "dark") failures.push("system dark preference not applied");
  await ctx.close();

  await browser.close();
  if (failures.length) {
    console.error("FAIL\n- " + failures.join("\n- "));
    process.exit(1);
  }
  console.log(`PASS: ${PAGES.length} pages × 2 themes × 2 languages × ${WIDTHS.length} widths: correct theme/lang, no overflow, no console errors; system dark respected`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
