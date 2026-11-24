/**
 * End-to-end check of the blood pressure module in the /check flow (draft module → preview on localhost).
 * Readings come from the shared profile; checks the band and next step for three readings, in English and Khmer at 375 px.
 *
 * Run (server must be running): BASE_URL=http://localhost:3100 npx tsx tests/e2e/check-bp.e2e.ts
 */
import fs from "node:fs";
import { chromium, type Page } from "playwright-core";
import en from "../../src/lib/i18n/en.json";
import km from "../../src/lib/i18n/km.json";
import { bpCheckModule } from "../../src/lib/modules/bp-check/definition";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR ?? "";
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
];
type Dict = typeof en;

async function run(page: Page, lang: "en" | "km", t: Dict, sbp: string, dbp: string) {
  await page.goto(`${BASE}/${lang}/check?preview=1`);
  await page.getByRole("button", { name: t.urgent.none }).click();
  await page.getByLabel(t.risk.sex.male, { exact: true }).check();
  await page.getByLabel(t.risk.age.q).fill("50");
  await page.getByLabel(t.risk.height.q).fill("165");
  await page.getByLabel(t.risk.weight.q).fill("65");
  await page.getByLabel(t.risk.waist.q).fill("33.5") /* inches */;
  await page.getByLabel(t.check.smokingStatus.never).check();
  await page.getByLabel(t.check.sbp).fill(sbp);
  await page.getByLabel(t.check.dbp).fill(dbp);
  await page.locator('input[name="bpMedication"]').nth(1).check(); // No
  await page.getByLabel(t.risk.family.none).check();
  await page.getByRole("button", { name: t.check.continue }).click();
  await page.getByRole("heading", { name: t.check.chooseTitle }).waitFor();
  for (const box of await page.getByRole("checkbox").all()) if (await box.isChecked()) await box.uncheck();
  await page.getByRole("checkbox", { name: bpCheckModule.title[lang] }).check();
  await page.getByRole("button", { name: t.check.continue }).click(); // no extra questions → straight to results
  await page.getByRole("heading", { name: t.check.dashboardTitle }).waitFor();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/bp-dashboard-${lang}-${sbp}-${dbp}.png`, fullPage: true });
  return {
    text: (await page.locator("main").innerText()).replaceAll("\u200B", ""), // Khmer line-break hints
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
  };
}

async function main() {
  const exe = BROWSERS.find((b) => fs.existsSync(b));
  if (!exe) throw new Error("No Chromium-based browser found");
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  const failures: string[] = [];
  const cases: [string, string, string, keyof Dict["results"]["nextSteps"]][] = [
    ["118", "76", "below_140_90", "bp_below"],
    ["146", "88", "high", "bp_recheck"],
    ["172", "104", "very_high", "bp_very_high"],
  ];
  for (const [lang, t] of [["en", en], ["km", km as unknown as Dict]] as const)
    for (const [sbp, dbp, band, step] of cases) {
      const r = await run(page, lang, t, sbp, dbp);
      const label = `${lang} ${sbp}/${dbp}`;
      if (!r.text.includes(bpCheckModule.bands[band][lang])) failures.push(`${label}: band "${band}" missing`);
      if (!r.text.includes(t.results.nextSteps[step])) failures.push(`${label}: next step ${step} missing`);
      if (r.overflow) failures.push(`${label}: horizontal overflow`);
    }
  await browser.close();
  if (failures.length) {
    console.error("FAIL\n- " + failures.join("\n- "));
    process.exit(1);
  }
  console.log("PASS: blood pressure check in /check (en + km): below 140/90, high and ≥160/100 readings, no overflow at 375 px");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
