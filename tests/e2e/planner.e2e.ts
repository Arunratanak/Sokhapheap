/**
 * Checkpoint 6: screening planner.
 *  - Plans for 3 provinces (km + en): top 5 match data/clean, printed PDF is exactly 1 A4 page and shows sources
 *  - /api/planner/<pcode> returns the same top 5
 *  - Org dashboard (demo org): access code → planner pre-selects the org's main province; CSV button present
 * Run (server must be running): BASE_URL=http://localhost:3100 npx tsx tests/e2e/planner.e2e.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { loadEnv } from "../../scripts/env";

loadEnv();
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR ?? "";
const BROWSERS = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/chromium"];
let failures = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "✓" : "✗"} ${m}`); if (!c) failures++; };

const gap = JSON.parse(fs.readFileSync("data/clean/gap_index_district.json", "utf8")).areas as { pcode: string; name_en: string; province_pcode: string; rank: number }[];

async function main() {
  const browser = await chromium.launch({ executablePath: BROWSERS.find((b) => fs.existsSync(b)), headless: true });
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

  for (const pc of ["KH19", "KH12", "KH11"]) {
    const expected = gap.filter((g) => g.province_pcode === pc).slice(0, 5).map((g) => g.name_en);
    const api = await (await fetch(`${BASE}/api/planner/${pc}`)).json();
    ok(JSON.stringify(api.top.map((d: { name: string }) => d.name)) === JSON.stringify(expected), `${pc} API top 5 = data/clean (${expected.join(", ")})`);
    for (const lang of ["km", "en"]) {
      const page = await browser.newPage();
      await page.goto(`${BASE}/${lang}/plan/${pc}`, { waitUntil: "networkidle" });
      const text = (await page.locator("main").innerText()).replaceAll("\u200b", "");
      const rowsOk = expected.every((name) => text.includes(name));
      const sourcesOk = ["WorldPop", "Malaria Atlas", "Demographic and Health Survey", "Subnational Administrative Boundaries"].every((s) => text.includes(s));
      const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
      const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      if (SHOTS && lang === "en") fs.writeFileSync(path.join(SHOTS, `plan_${pc}.pdf`), pdf);
      ok(rowsOk && sourcesOk && pages === 1, `${lang}/plan/${pc}: top 5 shown ${rowsOk}, sources ${sourcesOk}, PDF pages ${pages}`);
      await page.close();
    }
  }

  // Org dashboard → planner
  const code = process.env.ORG_DASHBOARD_ACCESS_CODE;
  if (!code) console.log("- skipped dashboard check (ORG_DASHBOARD_ACCESS_CODE not set)");
  else {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await page.goto(`${BASE}/en/org/DEMO`, { waitUntil: "networkidle" });
    await page.locator("input[type=password]").fill(code);
    await page.getByRole("button", { name: "Open dashboard" }).click();
    const planner = page.locator("section[aria-labelledby=planner-title]");
    await planner.waitFor({ timeout: 20000 });
    await planner.locator("ol li").first().waitFor({ timeout: 20000 });
    const selected = await planner.locator("select").inputValue();
    const items = await planner.locator("ol li").count();
    const txt = await planner.innerText();
    ok(selected === "KH12" && items === 5, `dashboard: planner pre-selects the demo org's province (${selected}) with ${items} districts`);
    ok(/Download plan \(CSV\)/.test(txt) && /Printable one-page plan/.test(txt), "dashboard: CSV and printable plan buttons shown");
    ok(/moderate or higher diabetes risk score/.test(txt) && /not directly comparable/.test(txt), "dashboard: comparison with area shown, with the 'not comparable' note");
    const [download] = await Promise.all([page.waitForEvent("download"), planner.getByRole("button", { name: /Download plan/ }).click()]);
    const csv = fs.readFileSync(await download.path(), "utf8").replace(/^\uFEFF/, "");
    ok(csv.split("\n").filter(Boolean).length === 6 && csv.startsWith("plan_order,district"), `dashboard: CSV has header + 5 rows (${download.suggestedFilename()})`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "planner-dashboard.png"), fullPage: true });
    await page.close();
  }

  await browser.close();
  console.log(failures ? `\n✗ ${failures} check(s) failed` : "\n✓ all planner checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
