/**
 * End-to-end check of the eGFR module in the /check flow (draft, opt-in → preview on localhost).
 * Enters creatinine in µmol/L and compares the eGFR on screen with the unit-tested equation, in English and Khmer at 375 px.
 *
 * Run (server must be running): BASE_URL=http://localhost:3100 npx tsx tests/e2e/check-egfr.e2e.ts
 */
import fs from "node:fs";
import { chromium, type Page } from "playwright-core";
import en from "../../src/i18n/en.json";
import km from "../../src/i18n/km.json";
import { toKhmerDigits } from "../../src/lib/client/util";
import { creatinineToMgdl, egfrCkdEpi2021 } from "../../src/domain/scoring/ckdEpi2021";
import { egfrModule } from "../../src/domain/modules/egfr/definition";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR ?? "";
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
];
type Dict = typeof en;

async function run(page: Page, lang: "en" | "km", t: Dict, creatinine: string | null) {
  await page.goto(`${BASE}/${lang}/check?preview=1`);
  await page.getByRole("button", { name: t.check.welcome.start }).click(); // welcome screen
  await page.getByRole("button", { name: t.urgent.none }).click();
  await page.getByLabel(t.risk.sex.male, { exact: true }).check();
  await page.getByLabel(t.risk.age.q).fill("70");
  await page.getByLabel(t.risk.height.q).fill("165");
  await page.getByLabel(t.risk.weight.q).fill("65");
  await page.getByLabel(t.risk.waist.q).fill("33.5") /* inches */;
  await page.getByLabel(t.check.smokingStatus.never).check();
  await page.getByLabel(t.check.bpUnknown).check();
  await page.locator('input[name="bpMedication"]').nth(1).check(); // No
  await page.getByLabel(t.risk.family.none).check();
  await page.getByRole("button", { name: t.check.continue }).click();
  await page.getByRole("heading", { name: t.check.chooseTitle }).waitFor();
  for (const box of await page.getByRole("checkbox").all()) if (await box.isChecked()) await box.uncheck();
  await page.getByRole("checkbox", { name: egfrModule.title[lang] }).check();
  await page.getByRole("button", { name: t.check.continue }).click();
  await page.getByRole("heading", { name: t.check.questionsTitle }).waitFor();
  if (creatinine) {
    await page.getByLabel(t.check.egfr.creatinine.q).fill(creatinine);
    await page.getByRole("button", { name: new RegExp(`^${t.common.next}`) }).click();
    await page.getByLabel(t.check.egfr.unit.umol, { exact: true }).check(); // shown once a number is entered
  } else await page.getByRole("checkbox", { name: t.check.unknown, exact: true }).check();
  await page.getByRole("button", { name: t.check.seeResults }).click();
  await page.getByRole("heading", { name: t.check.dashboardTitle }).waitFor();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/egfr-dashboard-${lang}-${creatinine ?? "unknown"}.png`, fullPage: true });
  return {
    text: (await page.locator("main").innerText()).replaceAll("\u200B", ""),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
  };
}

async function main() {
  const exe = BROWSERS.find((b) => fs.existsSync(b));
  if (!exe) throw new Error("No Chromium-based browser found");
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  const failures: string[] = [];
  const expected = Math.round(egfrCkdEpi2021(creatinineToMgdl(177, "µmol/L"), 70, "male")); // ≈ 2.0 mg/dL → 35

  for (const [lang, t] of [["en", en], ["km", km as unknown as Dict]] as const) {
    const shown = `${lang === "km" ? toKhmerDigits(expected) : expected}${egfrModule.scoreUnit![lang]}`;
    const r = await run(page, lang, t, "177");
    if (!r.text.includes(shown)) failures.push(`${lang}: expected "${shown}"`);
    if (!r.text.includes(egfrModule.bands["30-44"][lang])) failures.push(`${lang}: band 30-44 missing`);
    if (!r.text.includes(t.results.nextSteps.egfr_below_60)) failures.push(`${lang}: next step missing`);
    if (r.overflow) failures.push(`${lang}: horizontal overflow (value)`);

    const u = await run(page, lang, t, null);
    if (!u.text.includes(t.results.nextSteps.creatinine_test)) failures.push(`${lang}: creatinine-test next step missing`);
    if (u.overflow) failures.push(`${lang}: horizontal overflow (unknown)`);
  }
  await browser.close();
  if (failures.length) {
    console.error("FAIL\n- " + failures.join("\n- "));
    process.exit(1);
  }
  console.log(`PASS: eGFR in /check (en + km): ${expected} shown for 177 µmol/L, unknown path, no overflow at 375 px`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
