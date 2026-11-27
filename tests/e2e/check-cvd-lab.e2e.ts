/**
 * End-to-end check of the lab-based WHO heart risk module in the /check flow (draft module → preview on localhost).
 * Enters a cholesterol result in mg/dL and compares the % on screen with the unit-tested scoring function.
 * Also checks the "I don't know" path and horizontal overflow at 375 px, in English and Khmer.
 *
 * Run (server must be running): BASE_URL=http://localhost:3100 npx tsx tests/e2e/check-cvd-lab.e2e.ts
 */
import { chromium, type Page } from "playwright-core";
import en from "../../src/i18n/en.json";
import km from "../../src/i18n/km.json";
import { calculateWhoCvdLab, toMmol } from "../../src/domain/scoring/whoCvdLab";
import { toKhmerDigits } from "../../src/lib/client/util";
import { whoCvdLabModule } from "../../src/domain/modules/who-cvd-lab/definition";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR ?? "";
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
];

type Dict = typeof en;

async function fillProfile(page: Page, t: Dict) {
  await page.getByRole("button", { name: t.check.welcome.start }).click(); // welcome screen
  await page.getByLabel(t.risk.sex.male, { exact: true }).check();
  await page.getByLabel(t.risk.age.q).fill("61");
  await page.getByLabel(t.risk.height.q).fill("165");
  await page.getByLabel(t.risk.weight.q).fill("78");
  await page.getByLabel(t.risk.waist.q).fill("38.6") /* inches */;
  await page.getByLabel(t.check.smokingStatus.current).check();
  await page.getByLabel(t.check.sbp).fill("125");
  await page.getByLabel(t.check.dbp).fill("80");
  await page.locator('input[name="bpMedication"]').nth(1).check(); // No
  await page.getByLabel(t.risk.family.none).check();
  await page.getByRole("button", { name: t.check.continue }).click();
  await page.getByRole("heading", { name: t.check.chooseTitle }).waitFor();
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

async function run(page: Page, lang: "en" | "km", t: Dict, cholesterol: { value: string; unit: "mg/dL" | "mmol/L" } | null) {
  await page.goto(`${BASE}/${lang}/check?preview=1`);
  await fillProfile(page, t);
  // Only the lab heart module, so the dashboard has a single card to read.
  for (const box of await page.getByRole("checkbox").all()) if (await box.isChecked()) await box.uncheck();
  await page.getByRole("checkbox", { name: whoCvdLabModule.title[lang] }).check();
  await page.getByRole("button", { name: t.check.continue }).click();

  await page.getByRole("heading", { name: t.check.questionsTitle }).waitFor();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cvd-lab-questions-${lang}.png`, fullPage: true });
  if (cholesterol) {
    await page.getByLabel(t.check.cvdLab.cholesterol.q).fill(cholesterol.value);
    await page.getByRole("button", { name: new RegExp(`^${t.common.next}`) }).click();
    await page.getByLabel(cholesterol.unit === "mg/dL" ? t.check.cvdLab.unit.mgdl : t.check.cvdLab.unit.mmol, { exact: true }).check();
  } else {
    await page.getByRole("checkbox", { name: t.check.unknown, exact: true }).check();
    await page.getByRole("button", { name: new RegExp(`^${t.common.next}`) }).click();
    // The unit question only appears once a number is entered.
    if (await page.getByLabel(t.check.cvdLab.unit.mmol, { exact: true }).count()) throw new Error("unit asked without a cholesterol value");
  }
  await page.getByLabel(t.check.cvdLab.glucose.normal).check();
  await page.getByRole("button", { name: t.check.seeResults }).click();
  await page.getByRole("heading", { name: t.check.dashboardTitle }).waitFor();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cvd-lab-dashboard-${lang}-${cholesterol ? "value" : "unknown"}.png`, fullPage: true });
  // Khmer strings get zero-width spaces between words for line wrapping (src/i18n/index.ts); compare without them.
  return { text: (await page.locator("main").innerText()).replaceAll("​", ""), overflow: await overflow(page) };
}

async function main() {
  const exe = BROWSERS.find((b) => fs.existsSync(b));
  if (!exe) throw new Error("No Chromium-based browser found");
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  const failures: string[] = [];

  const expected = calculateWhoCvdLab({ age: 61, sex: "male", smoker: true, sbp: 125, totalCholesterolMmol: toMmol(162, "mg/dL"), diabetes: false });
  if (!expected.available) throw new Error("expected a result");

  for (const [lang, t] of [["en", en], ["km", km as unknown as Dict]] as const) {
    const pct = `${lang === "km" ? toKhmerDigits(expected.riskPercent) : expected.riskPercent}%`;
    const withValue = await run(page, lang, t, { value: "162", unit: "mg/dL" });
    if (!withValue.text.includes(pct)) failures.push(`${lang}: expected ${pct} on the dashboard`);
    if (!withValue.text.includes(t.results.cvdBands[expected.band])) failures.push(`${lang}: band words missing`);
    if (!withValue.text.includes(t.results.nextSteps.cvd_followup_10_20)) failures.push(`${lang}: Table 3 next step missing`);
    if (withValue.overflow) failures.push(`${lang}: horizontal overflow (value)`);

    const unknown = await run(page, lang, t, null);
    if (!unknown.text.includes(t.results.cvdLabUnavailable.cholesterol_unknown)) failures.push(`${lang}: cholesterol-unknown text missing`);
    if (!unknown.text.includes(t.results.nextSteps.cholesterol_test)) failures.push(`${lang}: cholesterol-test next step missing`);
    if (unknown.overflow) failures.push(`${lang}: horizontal overflow (unknown)`);
  }

  await browser.close();
  if (failures.length) {
    console.error("FAIL\n- " + failures.join("\n- "));
    process.exit(1);
  }
  console.log(`PASS: lab-based heart risk in /check (en + km): ${expected.riskPercent}% shown, unknown path, no overflow at 375 px`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
