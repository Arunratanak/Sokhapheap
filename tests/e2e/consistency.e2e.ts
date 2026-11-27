/**
 * Verification C18 / I3: the same input gives the same result everywhere.
 * 3 fixed profiles (low, moderate, high) compared across:
 *   unit functions · /api/risk (LOCAL + PROD) · web UI (LOCAL + PROD) · Telegram bot logic (offline)
 *
 * Nothing is saved and no AI quota is used: API calls send save:false, the browser's /api/risk request is
 * rewritten to save:false and /api/explain is blocked (template text), and the bot runs with AI/DB env cleared
 * and a fake Telegram API (no messages are sent to Telegram).
 *
 * Run: LOCAL_URL=http://localhost:3100 PROD_URL=https://<app>.onrender.com \
 *      npx tsx --conditions=react-server tests/e2e/consistency.e2e.ts
 */
import fs from "node:fs";
import { chromium, type Page } from "playwright-core";
import { waistCmToInches } from "../../src/domain/units";

// Bot runs offline: no AI, no database, fake token.
for (const k of ["GEMINI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) delete process.env[k];

const LOCAL = process.env.LOCAL_URL ?? "http://localhost:3100";
const PROD = process.env.PROD_URL ?? "";
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
];

type Profile = {
  name: string; sex: "male" | "female"; age: number; heightCm: number; weightKg: number; waistCm: number | null;
  physicallyActive: boolean; dailyVegFruit: boolean; bpMedication: boolean; highGlucoseHistory: boolean;
  familyHistory: "none" | "second_degree" | "first_degree"; smoker: boolean; sbp: number | null;
};
export const PROFILES: Profile[] = [
  { name: "LOW", sex: "male", age: 42, heightCm: 170, weightKg: 60, waistCm: 80, physicallyActive: true, dailyVegFruit: true,
    bpMedication: false, highGlucoseHistory: false, familyHistory: "none", smoker: false, sbp: 115 },
  { name: "MODERATE", sex: "female", age: 50, heightCm: 155, weightKg: 62, waistCm: 85, physicallyActive: false, dailyVegFruit: false,
    bpMedication: false, highGlucoseHistory: false, familyHistory: "second_degree", smoker: false, sbp: 135 },
  { name: "HIGH", sex: "male", age: 58, heightCm: 165, weightKg: 78, waistCm: 98, physicallyActive: false, dailyVegFruit: false,
    bpMedication: true, highGlucoseHistory: false, familyHistory: "second_degree", smoker: true, sbp: 150 },
  // C11: blood pressure unknown → heart risk unavailable, "check your blood pressure first"
  { name: "BP UNKNOWN", sex: "male", age: 58, heightCm: 165, weightKg: 78, waistCm: 98, physicallyActive: false, dailyVegFruit: false,
    bpMedication: true, highGlucoseHistory: false, familyHistory: "second_degree", smoker: true, sbp: null },
];

type Row = { score: number; band: string; cvd: string };
const fmtRow = (r: Row | string) => (typeof r === "string" ? r : `${r.score} ${r.band} · CVD ${r.cvd}`);

async function unit(p: Profile): Promise<Row> {
  const { calculateFindrisc } = await import("../../src/domain/scoring/findrisc");
  const { calculateWhoCvd } = await import("../../src/domain/scoring/whoCvd");
  const f = calculateFindrisc(p);
  const c = calculateWhoCvd({ age: p.age, sex: p.sex, smoker: p.smoker, sbp: p.sbp, bmi: f.bmi });
  return { score: f.score, band: f.band, cvd: c.available ? `${c.riskPercent}% (${c.band})` : c.reason };
}

async function api(base: string, p: Profile): Promise<Row> {
  const body: Partial<Profile> = { ...p };
  delete body.name;
  const r = await fetch(`${base}/api/risk`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, save: false }),
    signal: AbortSignal.timeout(120000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j)}`);
  return { score: j.findrisc.score, band: j.findrisc.band, cvd: j.cvd.available ? `${j.cvd.riskPercent}% (${j.cvd.band})` : j.cvd.reason };
}

// ---------- web UI (English labels, same flow as risk-ui.e2e.ts) ----------
async function stepLabel(page: Page) {
  return page.evaluate(() => document.body.innerText.match(/Question \d+ of \d+/)?.[0] ?? "");
}
async function click(page: Page, text: string | RegExp) {
  const before = await stepLabel(page);
  await page.getByRole("button", { name: text }).first().click();
  if (before) await page.waitForFunction((b) => !document.body.innerText.includes(b), before, { timeout: 20000 });
}
async function num(page: Page, v: number | null) {
  if (v === null) return click(page, "I don't know");
  await page.locator("input[inputmode=decimal]").fill(String(v));
  await click(page, /^Next/);
}

async function ui(page: Page, base: string, p: Profile): Promise<Row> {
  const en = JSON.parse(fs.readFileSync("src/i18n/en.json", "utf8"));
  await page.goto(`${base}/en/risk`, { timeout: 120000 });
  await click(page, /None of these/);
  await click(page, p.sex === "male" ? /Man/ : /Woman/);
  for (const v of [p.age, p.heightCm, p.weightKg, p.waistCm === null ? null : waistCmToInches(p.waistCm)]) await num(page, v); // waist asked in inches
  for (const yes of [p.physicallyActive, p.dailyVegFruit, p.bpMedication, p.highGlucoseHistory]) await click(page, yes ? /^Yes$/ : /^No$/);
  await click(page, p.familyHistory === "none" ? /No \/ I don't know/ : p.familyHistory === "second_degree" ? /grandparent/ : /parent, brother/);
  await click(page, p.smoker ? /^Yes$/ : /^No$/);
  await num(page, p.sbp);
  await click(page, /Prefer not to say/);
  await page.getByRole("heading", { name: "Your results" }).waitFor({ timeout: 30000 });
  const text = (await page.locator("main").innerText()).replaceAll("\u200b", "");
  const m = text.match(/Score (\d+)(?:–\d+)? out of 26/);
  if (!m) throw new Error("score not shown");
  const band = Object.entries(en.results.findriscBands as Record<string, string>).find(([, label]) => text.includes(label.replaceAll("\u200b", "")))?.[0] ?? "?";
  const cvdKey = Object.entries(en.results.cvdBands as Record<string, string>).find(([, label]) => text.includes(label))?.[0];
  const cvdReason = Object.entries(en.results.cvdUnavailable as Record<string, string>).find(([, label]) => text.includes(label))?.[0];
  if (!text.includes("This is not a diagnosis. Please consult a doctor.")) throw new Error("disclaimer missing");
  return { score: Number(m[1]), band, cvd: cvdKey ? `(${cvdKey})` : cvdReason ?? "?" };
}

// ---------- Telegram bot (real handlers, fake Telegram API) ----------
async function bot(p: Profile, chatId: number): Promise<Row> {
  const { createBot, getSession } = await import("../../src/server/bot/bot");
  const b = createBot("123456:TEST");
  b.botInfo = { id: 1, is_bot: true, first_name: "Test", username: "test_bot", can_join_groups: false,
    can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false,
    has_main_web_app: false } as never;
  const sent: string[] = [];
  b.api.config.use(async (_prev, method, payload) => {
    if (method === "sendMessage") sent.push((payload as { text: string }).text);
    return { ok: true, result: method === "sendMessage" ? { message_id: sent.length, date: 0, chat: { id: chatId, type: "private" }, text: "" } : true } as never;
  });
  getSession(chatId).lang = "en";
  const chat = { id: chatId, type: "private" as const, first_name: "T" };
  const from = { id: chatId, is_bot: false, first_name: "T" };
  let uid = 1;
  const text = (t: string) => b.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat, from, text: t,
    ...(t.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: t.length }] } : {}) } } as never);
  const tap = (data: string) => b.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from, chat_instance: "x", data,
    message: { message_id: uid, date: 0, chat, text: "" } } } as never);

  await text("/check");
  await tap("urgent:no");
  await tap(`a:sex:${p.sex}`);
  for (const [k, v] of [["age", p.age], ["heightCm", p.heightCm], ["weightKg", p.weightKg], ["waistCm", p.waistCm === null ? null : waistCmToInches(p.waistCm)]] as const) // waist in inches
    await (v === null ? tap(`a:${k}:null`) : text(String(v)));
  for (const k of ["physicallyActive", "dailyVegFruit", "bpMedication", "highGlucoseHistory"] as const) await tap(`a:${k}:${p[k] ? 1 : 0}`);
  await tap(`a:familyHistory:${p.familyHistory}`);
  await tap(`a:smoker:${p.smoker ? 1 : 0}`);
  await (p.sbp === null ? tap("a:sbp:null") : text(String(p.sbp)));

  const msg = sent.find((s) => /26/.test(s) && /%|blood pressure|40/.test(s)) ?? sent.find((s) => /26/.test(s));
  if (!msg) throw new Error(`no result message; got: ${sent.slice(-3).join(" | ").slice(0, 200)}`);
  const en = JSON.parse(fs.readFileSync("src/i18n/en.json", "utf8"));
  const clean = msg.replaceAll("\u200b", "");
  const score = Number(clean.match(/(\d+)(?:–\d+)?\s*(?:\/|out of)\s*26/)?.[1] ?? NaN);
  const band = Object.entries(en.results.findriscBands as Record<string, string>).find(([, l]) => clean.includes(l))?.[0] ?? "?";
  const cvdKey = Object.entries(en.results.cvdBands as Record<string, string>).find(([, l]) => clean.includes(l))?.[0];
  const cvdReason = Object.entries(en.results.cvdUnavailable as Record<string, string>).find(([, l]) => clean.includes(l))?.[0];
  if (process.env.SHOW_BOT) console.log(`--- bot message (${p.name}) ---\n${clean}\n---`);
  return { score, band, cvd: cvdKey ? `(${cvdKey})` : cvdReason ?? "?" };
}

const cvdBandOf = (s: string) => s.match(/\(([^)]+)\)/)?.[1] ?? s;

async function main() {
  const executablePath = BROWSERS.find((b) => fs.existsSync(b));
  if (!executablePath) throw new Error("No Edge/Chrome found");
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, locale: "en-US" });
  await page.route("**/api/explain", (r) => r.abort());
  await page.route("**/api/risk", async (r) => {
    const body = JSON.parse(r.request().postData() ?? "{}");
    await r.continue({ postData: JSON.stringify({ ...body, save: false }) });
  });

  let mismatches = 0;
  for (const [i, p] of PROFILES.entries()) {
    const u = await unit(p);
    const results: [string, Row | string][] = [["unit", u]];
    const run = async (label: string, fn: () => Promise<Row>) => {
      try { results.push([label, await fn()]); } catch (e) { results.push([label, `ERROR ${(e as Error).message.slice(0, 120)}`]); }
    };
    await run("api LOCAL", () => api(LOCAL, p));
    if (PROD) await run("api PROD", () => api(PROD, p));
    await run("web LOCAL", () => ui(page, LOCAL, p));
    if (PROD) await run("web PROD", () => ui(page, PROD, p));
    await run("bot", () => bot(p, 900000 + i));

    console.log(`\n${p.name}: ${JSON.stringify({ ...p, name: undefined })}`);
    for (const [label, r] of results) {
      const ok = typeof r !== "string" && r.score === u.score && r.band === u.band && cvdBandOf(r.cvd) === cvdBandOf(u.cvd);
      if (!ok) mismatches++;
      console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(10)} ${fmtRow(r)}`);
    }
  }
  await browser.close();
  console.log(mismatches ? `\n✗ ${mismatches} mismatch(es)` : "\n✓ all sources agree");
  process.exit(mismatches ? 1 : 0);
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
