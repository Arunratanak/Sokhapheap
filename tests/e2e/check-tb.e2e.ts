/**
 * End-to-end check of the TB symptom screen in the /check flow (draft module → preview on localhost).
 * Three paths (one symptom, close contact only, nothing) in English and Khmer at 375 px.
 *
 * Run (server must be running): BASE_URL=http://localhost:3100 npx tsx tests/e2e/check-tb.e2e.ts
 */
import fs from "node:fs";
import { chromium, type Page } from "playwright-core";
import en from "../../src/lib/i18n/en.json";
import km from "../../src/lib/i18n/km.json";
import { TB_SYMPTOMS, tbSymptomModule } from "../../src/lib/modules/tb-symptom/definition";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR ?? "";
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
];
type Dict = typeof en;

async function run(page: Page, lang: "en" | "km", t: Dict, yes: string[]) {
  await page.goto(`${BASE}/${lang}/check?preview=1`);
  await page.getByRole("button", { name: t.urgent.none }).click();
  await page.getByLabel(t.risk.sex.female, { exact: true }).check();
  await page.getByLabel(t.risk.age.q).fill("35");
  await page.getByLabel(t.risk.height.q).fill("155");
  await page.getByLabel(t.risk.weight.q).fill("50");
  await page.getByLabel(t.risk.waist.q).fill("29.5") /* inches */;
  await page.locator('input[name="pregnant"]').first().check(); // "No" (first option)
  await page.getByLabel(t.check.smokingStatus.never).check();
  await page.getByLabel(t.check.bpUnknown).check();
  await page.locator('input[name="bpMedication"]').nth(1).check(); // No
  await page.getByLabel(t.risk.family.none).check();
  await page.getByRole("button", { name: t.check.continue }).click();
  await page.getByRole("heading", { name: t.check.chooseTitle }).waitFor();
  for (const box of await page.getByRole("checkbox").all()) if (await box.isChecked()) await box.uncheck();
  await page.getByRole("checkbox", { name: tbSymptomModule.title[lang] }).check();
  await page.getByRole("button", { name: t.check.continue }).click();

  await page.getByRole("heading", { name: t.check.questionsTitle }).waitFor();
  for (const q of tbSymptomModule.questions) await page.locator(`input[name="tb_symptom.${q.id}"]`).nth(yes.includes(q.id) ? 0 : 1).check();
  if (SHOTS && yes.length === 0) await page.screenshot({ path: `${SHOTS}/tb-questions-${lang}.png`, fullPage: true });
  await page.getByRole("button", { name: t.check.seeResults }).click();
  await page.getByRole("heading", { name: t.check.dashboardTitle }).waitFor();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tb-dashboard-${lang}-${yes.join("+") || "none"}.png`, fullPage: true });
  const text = (await page.locator("main").innerText()).replaceAll("\u200B", ""); // Khmer line-break hints
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  return { text, overflow };
}

async function main() {
  const exe = BROWSERS.find((b) => fs.existsSync(b));
  if (!exe) throw new Error("No Chromium-based browser found");
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  const failures: string[] = [];

  for (const [lang, t] of [["en", en], ["km", km as unknown as Dict]] as const) {
    const cases: [string[], "positive" | "contact" | "negative", keyof Dict["results"]["nextSteps"], string[]][] = [
      [["tbNightSweats"], "positive", "tb_test", ["tb_symptom_tbNightSweats"]],
      [["tbContact"], "contact", "tb_contact_check", ["tb_contact"]],
      [[], "negative", "tb_watch", []],
    ];
    for (const [yes, band, step, factors] of cases) {
      const r = await run(page, lang, t, yes);
      const label = `${lang} ${yes.join("+") || "none"}`;
      if (!r.text.includes(tbSymptomModule.bands[band][lang])) failures.push(`${label}: band "${band}" missing`);
      if (!r.text.includes(t.results.nextSteps[step])) failures.push(`${label}: next step ${step} missing`);
      for (const f of factors) if (!r.text.includes(t.results.factors[f as keyof Dict["results"]["factors"]])) failures.push(`${label}: factor ${f} missing`);
      if (r.overflow) failures.push(`${label}: horizontal overflow`);
    }
  }
  await browser.close();
  if (failures.length) {
    console.error("FAIL\n- " + failures.join("\n- "));
    process.exit(1);
  }
  console.log(`PASS: TB symptom screen in /check (en + km): positive (${TB_SYMPTOMS.length} symptoms asked), contact and negative paths, no overflow at 375 px`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
