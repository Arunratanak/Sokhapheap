/**
 * Accessibility check with axe-core (the engine behind Lighthouse's accessibility audit)
 * on key pages at 375 px, in both languages, including the results screen.
 *
 * Run (server must be running): BASE_URL=http://localhost:3100 npx tsx tests/e2e/a11y.e2e.ts
 */
import fs from "node:fs";
import { chromium, type Page } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
];

interface AxeResult { violations: { id: string; impact: string; help: string; nodes: { target: string[] }[] }[]; passes: unknown[] }

async function audit(page: Page, label: string) {
  await page.addScriptTag({ content: AXE });
  const r: AxeResult = await page.evaluate(async () =>
    // @ts-expect-error axe is injected
    await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] } }),
  );
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  console.log(`${serious.length ? "✗" : "✓"} ${label}: ${r.passes.length} rules passed, ${r.violations.length} violations (${serious.length} serious/critical)`);
  for (const v of r.violations) console.log(`    [${v.impact}] ${v.id}: ${v.help} → ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`);
  return serious.length;
}

async function main() {
  const executablePath = BROWSERS.find((b) => fs.existsSync(b));
  if (!executablePath) throw new Error("No Edge/Chrome found");
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  let serious = 0;
  for (const p of ["/km", "/en", "/km/risk", "/en/map", "/km/lab", "/en/about", "/km/insights", "/en/insights"]) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    serious += await audit(page, p);
  }
  // Results page via demo mode
  await page.goto(`${BASE}/km/risk?demo=1`, { waitUntil: "networkidle" });
  for (let i = 0; i < 13; i++) {
    await page.getByRole("button", { name: /បន្ទាប់|មើលលទ្ធផលរបស់ខ្ញុំ/ }).first().click();
    await page.waitForTimeout(250);
  }
  await page.getByRole("heading", { name: "លទ្ធផលរបស់អ្នក" }).waitFor({ timeout: 15000 });
  serious += await audit(page, "/km/risk (results)");
  await browser.close();
  process.exit(serious ? 1 : 0);
}

main();
