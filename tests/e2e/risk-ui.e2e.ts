/**
 * End-to-end check of the risk flow in a real browser (installed Edge/Chrome via playwright-core).
 * Runs the FINDRISC cases through the UI at 375 px width and compares the score shown on screen
 * with the unit-tested scoring function. Also checks for horizontal overflow.
 *
 * Run (server must be running): BASE_URL=http://localhost:3100 npx tsx tests/e2e/risk-ui.e2e.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { calculateFindrisc, type FindriscInput } from "../../src/lib/scoring/findrisc";
import { waistCmToInches, waistInchesToCm } from "../../src/lib/units";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR ?? "";
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
];

type Case = FindriscInput & { smoker: boolean; sbp: number | null };
const base: Case = {
  age: 30, sex: "male", heightCm: 170, weightKg: 60, waistCm: 80, physicallyActive: true, dailyVegFruit: true,
  bpMedication: false, highGlucoseHistory: false, familyHistory: "none", smoker: false, sbp: 120,
};
// Same 10 scenarios as findrisc.test.ts
export const CASES: Case[] = [
  base,
  { ...base, age: 45 },
  { ...base, age: 65, sex: "female", waistCm: 80 },
  { ...base, heightCm: 200, weightKg: 121 },
  { ...base, waistCm: 102.1 },
  { ...base, familyHistory: "second_degree", physicallyActive: false },
  { ...base, age: 70, heightCm: 160, weightKg: 90, waistCm: 110, physicallyActive: false, dailyVegFruit: false, bpMedication: true, highGlucoseHistory: true, familyHistory: "first_degree" },
  { ...base, age: 55, heightCm: 200, weightKg: 110, highGlucoseHistory: true, physicallyActive: false, dailyVegFruit: false },
  { ...base, age: 65, waistCm: 95, highGlucoseHistory: true, bpMedication: true, dailyVegFruit: false, sbp: null },
  { ...base, age: 60, waistCm: null, highGlucoseHistory: true, dailyVegFruit: false },
];

async function stepLabel(page: Page) {
  return page.evaluate(() => document.body.innerText.match(/Question \d+ of \d+/)?.[0] ?? "");
}

/** Click a button and, if we are inside the questionnaire, wait until the next question is shown. */
async function clickText(page: Page, text: string | RegExp) {
  const before = await stepLabel(page);
  await page.getByRole("button", { name: text }).first().click();
  if (before) await page.waitForFunction((b) => !document.body.innerText.includes(b), before, { timeout: 15000 });
}

async function answerNumber(page: Page, value: number | null) {
  if (value === null) return clickText(page, "I don't know");
  await page.locator("input[inputmode=decimal]").fill(String(value));
  await clickText(page, /^Next/);
}

async function checkNoOverflow(page: Page, label: string) {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  if (w > 375) throw new Error(`${label}: horizontal overflow (${w}px)`);
}

async function runCase(page: Page, c: Case, i: number) {
  await page.goto(`${BASE}/en/risk`);
  await checkNoOverflow(page, "urgent screen");
  if (i === 0 && SHOTS) await page.screenshot({ path: path.join(SHOTS, "01-urgent.png"), fullPage: true });
  await clickText(page, /None of these/);
  await clickText(page, c.sex === "male" ? /Man/ : /Woman/);
  await answerNumber(page, c.age);
  if (i === 0 && SHOTS) await page.screenshot({ path: path.join(SHOTS, "02-question.png"), fullPage: true });
  await answerNumber(page, c.heightCm);
  await answerNumber(page, c.weightKg);
  await answerNumber(page, c.waistCm === null ? null : waistCmToInches(c.waistCm)); // the form asks inches
  for (const yes of [c.physicallyActive, c.dailyVegFruit, c.bpMedication, c.highGlucoseHistory]) await clickText(page, yes ? /^Yes$/ : /^No$/);
  await clickText(page, c.familyHistory === "none" ? /No \/ I don't know/ : c.familyHistory === "second_degree" ? /grandparent/ : /parent, brother/);
  await clickText(page, c.smoker ? /^Yes$/ : /^No$/);
  await answerNumber(page, c.sbp);
  await clickText(page, /Prefer not to say/);
  await page.getByRole("heading", { name: "Your results" }).waitFor({ timeout: 15000 });
  const text = await page.locator("main").innerText();
  const m = text.match(/Score (\d+)(?:–(\d+))? out of 26/);
  if (!m) throw new Error("score not shown");
  if (!text.includes("This is not a diagnosis. Please consult a doctor.")) throw new Error("disclaimer missing");
  await checkNoOverflow(page, "results");
  if (i === 6 && SHOTS) {
    await page.getByText(/Standard explanation|Written by AI/).waitFor({ timeout: 40000 }).catch(() => {});
    await page.screenshot({ path: path.join(SHOTS, "03-results.png"), fullPage: true });
  }
  return { ui: Number(m[1]), uiMax: m[2] ? Number(m[2]) : Number(m[1]) };
}

async function main() {
  const executablePath = BROWSERS.find((b) => fs.existsSync(b));
  if (!executablePath) throw new Error("No Edge/Chrome found");
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: "en-US" });
  // Never save test runs to the real database (the local server uses the same Supabase project as PROD).
  await page.route("**/api/risk", async (r) => {
    const body = JSON.parse(r.request().postData() ?? "{}");
    await r.continue({ postData: JSON.stringify({ ...body, save: false }) });
  });
  let pass = 0;
  for (const [i, c] of CASES.entries()) {
    // The UI asks the waist in inches; score the same rounded value the app stores.
    const expected = calculateFindrisc({ ...c, waistCm: c.waistCm === null ? null : waistInchesToCm(waistCmToInches(c.waistCm)) });
    try {
      const { ui, uiMax } = await runCase(page, c, i);
      const ok = ui === expected.score && uiMax === expected.scoreMax;
      if (ok) pass++;
      console.log(`${ok ? "✓" : "✗"} case ${i + 1}: UI ${ui}${uiMax !== ui ? `–${uiMax}` : ""} vs unit ${expected.score}${expected.scoreMax !== expected.score ? `–${expected.scoreMax}` : ""} (${expected.band})`);
    } catch (e) {
      console.log(`✗ case ${i + 1}: ${(e as Error).message}`);
    }
  }
  await browser.close();
  console.log(`\n${pass}/${CASES.length} cases match`);
  process.exit(pass === CASES.length ? 0 : 1);
}

main();
