/**
 * Generates 10 FAKE lab report images (HTML rendered to PNG) + expected JSON in tests/fixtures/lab_reports.
 * All names, labs and numbers are fictional test data, clearly marked "SAMPLE — NOT A REAL REPORT".
 * Printed reference ranges on these fake reports exist only to test extraction; the app's own
 * ranges live in src/lib/scoring/labRanges.ts.
 *
 * Run: npx tsx scripts/make_lab_fixtures.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const OUT = path.resolve(__dirname, "../tests/fixtures/lab_reports");
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium",
];

interface Line { name: string; nameKm?: string; value: number; unit: string; low: number | null; high: number | null }
interface Report { id: string; layout: "en" | "km" | "bilingual" | "fr"; lab: string; lines: Line[] }

const R: Report[] = [
  { id: "01_en_normal_mgdl", layout: "en", lab: "Sample Diagnostic Lab", lines: [
    { name: "Fasting Blood Sugar (FBS)", value: 92, unit: "mg/dL", low: 70, high: 110 },
    { name: "Total Cholesterol", value: 182, unit: "mg/dL", low: null, high: 200 },
    { name: "Triglycerides", value: 120, unit: "mg/dL", low: null, high: 150 },
    { name: "HDL Cholesterol", value: 52, unit: "mg/dL", low: 40, high: null },
    { name: "LDL Cholesterol", value: 104, unit: "mg/dL", low: null, high: 130 },
  ] },
  { id: "02_en_high_glucose", layout: "en", lab: "Sample City Clinic Laboratory", lines: [
    { name: "Glucose (Fasting)", value: 148, unit: "mg/dL", low: 70, high: 110 },
    { name: "HbA1c", value: 7.2, unit: "%", low: 4.0, high: 6.0 },
    { name: "Creatinine", value: 1.0, unit: "mg/dL", low: 0.7, high: 1.3 },
  ] },
  { id: "03_km_mixed", layout: "km", lab: "មន្ទីរពិសោធន៍គំរូ", lines: [
    { name: "Glucose", nameKm: "ជាតិស្ករ", value: 165, unit: "mg/dL", low: 70, high: 140 },
    { name: "Cholesterol Total", nameKm: "កូឡេស្តេរ៉ុលសរុប", value: 245, unit: "mg/dL", low: null, high: 200 },
    { name: "Triglyceride", nameKm: "ទ្រីគ្លីសេរីដ", value: 210, unit: "mg/dL", low: null, high: 150 },
  ] },
  { id: "04_en_mmol", layout: "en", lab: "Sample International Hospital Lab", lines: [
    { name: "Fasting Plasma Glucose", value: 6.4, unit: "mmol/L", low: 3.9, high: 6.1 },
    { name: "Total Cholesterol", value: 5.8, unit: "mmol/L", low: null, high: 5.2 },
    { name: "LDL-C", value: 3.9, unit: "mmol/L", low: null, high: 3.4 },
    { name: "HDL-C", value: 0.9, unit: "mmol/L", low: 1.0, high: null },
    { name: "Triglycerides", value: 1.4, unit: "mmol/L", low: null, high: 1.7 },
  ] },
  { id: "05_bilingual_normal", layout: "bilingual", lab: "Sample Health Lab / មន្ទីរពិសោធន៍សុខភាពគំរូ", lines: [
    { name: "FBS", nameKm: "ស្ករពេលតម", value: 88, unit: "mg/dL", low: 70, high: 110 },
    { name: "HbA1c", nameKm: "អេម៉ូក្លូប៊ីន A1c", value: 5.3, unit: "%", low: 4.0, high: 6.0 },
    { name: "Creatinine", nameKm: "គ្រីអាទីនីន", value: 0.8, unit: "mg/dL", low: 0.6, high: 1.2 },
  ] },
  { id: "06_fr_lipids", layout: "fr", lab: "Laboratoire Exemple", lines: [
    { name: "Glycémie à jeun", value: 1.05, unit: "g/L", low: 0.7, high: 1.1 },
    { name: "Cholestérol total", value: 2.3, unit: "g/L", low: null, high: 2.0 },
    { name: "Triglycérides", value: 1.2, unit: "g/L", low: null, high: 1.5 },
  ] },
  { id: "07_en_creatinine_umol", layout: "en", lab: "Sample Renal Unit Lab", lines: [
    { name: "Serum Creatinine", value: 132, unit: "µmol/L", low: 62, high: 106 },
    { name: "Random Blood Sugar (RBS)", value: 118, unit: "mg/dL", low: 70, high: 140 },
  ] },
  { id: "08_km_hba1c_only", layout: "km", lab: "គ្លីនិកគំរូ", lines: [
    { name: "HbA1c", nameKm: "HbA1c", value: 6.1, unit: "%", low: 4.0, high: 5.6 },
    { name: "FBS", nameKm: "ស្ករក្នុងឈាមពេលតម", value: 112, unit: "mg/dL", low: 70, high: 100 },
  ] },
  { id: "09_en_full_panel", layout: "en", lab: "Sample Medical Centre", lines: [
    { name: "Glucose, fasting", value: 101, unit: "mg/dL", low: 74, high: 106 },
    { name: "HbA1c", value: 5.9, unit: "%", low: null, high: 5.7 },
    { name: "Cholesterol, total", value: 199, unit: "mg/dL", low: null, high: 200 },
    { name: "LDL Cholesterol (calc)", value: 131, unit: "mg/dL", low: null, high: 100 },
    { name: "HDL Cholesterol", value: 38, unit: "mg/dL", low: 40, high: null },
    { name: "Triglycerides", value: 152, unit: "mg/dL", low: null, high: 150 },
    { name: "Creatinine", value: 1.4, unit: "mg/dL", low: 0.7, high: 1.2 },
  ] },
  { id: "10_bilingual_no_ranges", layout: "bilingual", lab: "Sample Community Lab / មន្ទីរពិសោធន៍សហគមន៍គំរូ", lines: [
    { name: "Fasting Glucose", nameKm: "ជាតិស្ករពេលតម", value: 96, unit: "mg/dL", low: null, high: null },
    { name: "Total Cholesterol", nameKm: "កូឡេស្តេរ៉ុលសរុប", value: 214, unit: "mg/dL", low: null, high: null },
    { name: "Triglycerides", nameKm: "ទ្រីគ្លីសេរីដ", value: 98, unit: "mg/dL", low: null, high: null },
  ] },
];

const fmtRange = (l: Line) => (l.low !== null && l.high !== null ? `${l.low} - ${l.high}` : l.high !== null ? `< ${l.high}` : l.low !== null ? `> ${l.low}` : "");

function html(r: Report) {
  const km = r.layout === "km";
  const fr = r.layout === "fr";
  const head = km
    ? ["តេស្ត", "លទ្ធផល", "ឯកតា", "តម្លៃយោង"]
    : fr ? ["Analyse", "Résultat", "Unité", "Valeurs de référence"]
    : r.layout === "bilingual" ? ["Test / តេស្ត", "Result / លទ្ធផល", "Unit", "Reference / តម្លៃយោង"]
    : ["Test", "Result", "Unit", "Reference Range"];
  const rows = r.lines.map((l) => {
    const name = km ? `${l.nameKm ?? l.name}<br><small>${l.name}</small>` : r.layout === "bilingual" ? `${l.name}<br><small>${l.nameKm ?? ""}</small>` : l.name;
    return `<tr><td>${name}</td><td class="v">${l.value}</td><td>${l.unit}</td><td>${fmtRange(l)}</td></tr>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;700&display=block" rel="stylesheet">
<style>body{font-family:'Noto Sans Khmer',Arial,sans-serif;margin:0;padding:28px;width:760px;background:#fff;color:#111}
h1{font-size:22px;margin:0}.sub{color:#555;font-size:13px}.stamp{border:2px dashed #c00;color:#c00;padding:6px 10px;display:inline-block;margin:10px 0;font-weight:700}
table{border-collapse:collapse;width:100%;margin-top:14px;font-size:16px}th,td{border:1px solid #999;padding:8px;text-align:left;vertical-align:top}th{background:#eef}
td.v{font-weight:700}small{color:#555}.meta{display:flex;justify-content:space-between;font-size:14px;margin-top:8px}</style></head>
<body><h1>${r.lab}</h1><div class="sub">${fr ? "Biochimie sanguine" : km ? "លទ្ធផលជីវគីមីឈាម" : "Blood Chemistry Report"}</div>
<div class="stamp">SAMPLE — NOT A REAL REPORT / គំរូ — មិនមែនលទ្ធផលពិត</div>
<div class="meta"><span>${km ? "ឈ្មោះ" : fr ? "Patient" : "Patient"}: SAMPLE PERSON</span><span>${km ? "ភេទ/អាយុ" : "Sex/Age"}: M / 52</span><span>2026-11-20</span></div>
<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
<p class="sub" style="margin-top:18px">${km ? "ហត្ថលេខាអ្នកបច្ចេកទេស" : "Technician"}: ________</p></body></html>`;
}

async function main() {
  const executablePath = BROWSERS.find((b) => fs.existsSync(b));
  if (!executablePath) throw new Error("No Edge/Chrome found");
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 816, height: 600 }, deviceScaleFactor: 1.5 });
  for (const r of R) {
    await page.setContent(html(r), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, `${r.id}.png`), fullPage: true });
    const expected = r.lines.map((l) => ({ test_name: l.name, value: l.value, unit: l.unit, printed_range_low: l.low, printed_range_high: l.high }));
    fs.writeFileSync(path.join(OUT, `${r.id}.expected.json`), JSON.stringify(expected, null, 2) + "\n");
  }
  await browser.close();
  console.log(`Wrote ${R.length} fixtures to ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
