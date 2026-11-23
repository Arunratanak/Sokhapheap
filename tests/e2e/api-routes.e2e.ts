/**
 * Verification Section F — API routes: valid → expected, invalid → 400 with a clear message, no crash.
 * Run against LOCAL or PROD:
 *   BASE_URL=http://localhost:3100 npx tsx tests/e2e/api-routes.e2e.ts
 *   AI=1 also makes the few real AI calls (1 explanation, 1 lab photo) — uses Gemini quota.
 *   EXPECT_TEMPLATE=1 asserts the explanation is template text (run with an invalid key, LOCAL only).
 */
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
// Retry only on network errors (this PC's connection drops sometimes); HTTP status codes are never retried.
const rawFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  for (let i = 1; ; i++) {
    try { return await rawFetch(input, init); } catch (e) { if (i >= 4) throw e; await new Promise((r) => setTimeout(r, 1500 * i)); }
  }
}) as typeof fetch;
const AI = process.env.AI === "1";
// Behind Cloudflare (PROD) the client IP cannot be faked, so all requests share one rate-limit bucket:
// SAME_IP=1 waits for the 1-minute window to reset before the rate-limit and AI sections.
const SAME_IP = process.env.SAME_IP === "1";
const pause = () => (SAME_IP ? new Promise((r) => setTimeout(r, 61_000)) : Promise.resolve());
let failures = 0;
const rows: string[] = [];
const ok = (id: string, cond: boolean, msg: string) => {
  rows.push(`${cond ? "✓" : "✗"} ${id} ${msg}`);
  console.log(`${cond ? "✓" : "✗"} ${id} ${msg}`);
  if (!cond) failures++;
};
// Each run uses its own fake client IP so rate limits from earlier runs don't interfere.
const IP = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
const H = { "content-type": "application/json", "x-forwarded-for": IP };
const post = (path: string, body: unknown, headers: Record<string, string> = H) =>
  fetch(`${BASE}${path}`, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
const get = (path: string) => fetch(`${BASE}${path}`, { headers: { "x-forwarded-for": IP }, signal: AbortSignal.timeout(120_000) });
const STACK = /\bat [\w$.<>]+ \(|node_modules|\.tsx?:\d+|webpack|TypeError|ReferenceError/;
const bodies: string[] = [];
const text = async (r: Response) => { const t = await r.text(); bodies.push(t); return t; };

const person = {
  age: 58, sex: "male", heightCm: 165, weightKg: 78, waistCm: 98, physicallyActive: false, dailyVegFruit: false,
  bpMedication: true, highGlucoseHistory: false, familyHistory: "second_degree", smoker: true, sbp: 150, save: false,
};

async function main() {
  console.log(`BASE ${BASE}  (AI calls: ${AI ? "yes" : "no"})\n`);

  // F1
  const h = await get("/api/health");
  const hj = JSON.parse(await text(h));
  ok("F1", h.status === 200 && hj.ok === true, `GET /api/health → ${h.status} ${JSON.stringify(hj).slice(0, 90)}`);

  // F2
  let r = await post("/api/risk", person);
  let j = JSON.parse(await text(r));
  ok("F2", r.status === 200 && j.findrisc.score === 15 && j.saved === false, `risk valid → ${r.status}, score ${j.findrisc?.score}, saved ${j.saved}`);
  for (const [label, body] of [
    ["missing fields", { age: 50 }],
    ["age 200", { ...person, age: 200 }],
    ["negative weight", { ...person, weightKg: -5 }],
    ["text instead of number", { ...person, heightCm: "tall" }],
    ["not JSON", "{oops"],
  ] as const) {
    r = await post("/api/risk", body);
    const t = await text(r);
    ok("F2", r.status === 400 && /error|invalid/i.test(t), `risk ${label} → ${r.status} ${t.slice(0, 110)}`);
  }

  // F3
  for (const [label, q, check] of [
    ["Phnom Penh", "lat=11.5564&lng=104.9282", (f: { province: string }[]) => f.length === 5 && f.every((x) => x.province === "Phnom Penh")],
    ["Siem Reap", "lat=13.3633&lng=103.8564", (f: { province: string }[]) => f.length === 5 && f[0].province === "Siemreap"],
    ["sea point (Gulf of Thailand)", "lat=10.0&lng=103.0", (f: { distance_m: number }[]) => f.length === 5 && f[0].distance_m > 10_000],
  ] as const) {
    r = await get(`/api/facilities/nearest?${q}&limit=5`);
    j = JSON.parse(await text(r));
    ok("F3", r.status === 200 && check(j.facilities), `nearest ${label} → ${r.status}, ${j.facilities?.length} results, first ${j.facilities?.[0]?.name} (${Math.round(j.facilities?.[0]?.distance_m)} m, ${j.facilities?.[0]?.province})`);
  }
  r = await get("/api/facilities/nearest?lat=abc&lng=104");
  ok("F3", r.status === 400, `nearest invalid lat → ${r.status} ${(await text(r)).slice(0, 90)}`);

  // F4
  r = await get("/api/facilities/by-area?province=Kampot");
  j = JSON.parse(await text(r));
  ok("F4", r.status === 200 && j.facilities.length > 0, `by-area Kampot → ${r.status}, ${j.facilities?.length} facilities`);
  r = await get("/api/facilities/by-area?province=Atlantis");
  ok("F4", r.status === 400, `by-area invalid province → ${r.status} ${(await text(r)).slice(0, 90)}`);

  // F7 (before AI)
  const v = (o: Record<string, unknown>) => ({ test_name: "Fasting Blood Sugar", value: 90, unit: "mg/dL", printed_range_low: null, printed_range_high: null, confidence: 0.95, ...o });
  r = await post("/api/lab/evaluate", {
    lang: "en",
    values: [v({}), v({ value: 160 }), v({ test_name: "Magic Factor" }), v({ unit: "g/L" })],
  });
  const ev = await text(r);
  let flags: string[] = [];
  try { flags = (JSON.parse(ev).results ?? JSON.parse(ev).values ?? []).map((x: { flag: string }) => x.flag); } catch { /* reported below */ }
  ok("F7", r.status === 200 && flags.join(",") === "normal,outside_range,could_not_read,could_not_read",
    `evaluate normal/abnormal/unknown test/wrong unit → ${r.status} [${flags.join(", ")}]`);
  r = await post("/api/lab/evaluate", { values: "nope" });
  ok("F7", r.status === 400, `evaluate invalid body → ${r.status} ${(await text(r)).slice(0, 80)}`);

  // F6 (validation, no AI)
  const fd = (blob: Blob | null, name = "x.png") => { const f = new FormData(); if (blob) f.append("image", blob, name); return f; };
  const postForm = (f: FormData) => fetch(`${BASE}/api/lab/extract`, { method: "POST", body: f, headers: { "x-forwarded-for": `${IP}9` } });
  r = await postForm(fd(new Blob(["hello"], { type: "text/plain" }), "notes.txt"));
  ok("F6", r.status === 400, `extract non-image → ${r.status} ${(await text(r)).slice(0, 80)}`);
  r = await postForm(fd(new Blob([new Uint8Array(9 * 1024 * 1024)], { type: "image/png" })));
  ok("F6", r.status === 400 || r.status === 413, `extract 9 MB image → ${r.status} ${(await text(r)).slice(0, 80)}`);
  r = await postForm(fd(null));
  ok("F6", r.status === 400, `extract empty request → ${r.status} ${(await text(r)).slice(0, 80)}`);

  // F8 / F9
  r = await post("/api/telegram", { update_id: 1 });
  ok("F8", r.status === 401 || r.status === 403, `telegram without secret header → ${r.status}`);
  r = await post("/api/telegram", { update_id: 1 }, { ...H, "x-telegram-bot-api-secret-token": "wrong" });
  ok("F8", r.status === 401 || r.status === 403, `telegram with wrong secret → ${r.status}`);
  r = await post("/api/cron/reminders", {});
  ok("F9", r.status === 401, `cron without CRON_SECRET → ${r.status}`);
  r = await post("/api/cron/reminders", {}, { ...H, "x-cron-secret": "wrong" });
  ok("F9", r.status === 401, `cron with wrong secret → ${r.status}`);

  await pause();
  // F10 rate limits on AI routes — invalid bodies (rejected after the limit check), so no AI is used.
  const ipRl = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  const codes: number[] = [];
  for (let i = 0; i < 16; i++) {
    const x = await fetch(`${BASE}/api/explain`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ipRl }, body: "{}" });
    codes.push(x.status);
    if (i === 15) bodies.push(await x.text());
  }
  ok("F10", codes.slice(0, 15).every((c) => c === 400) && codes[15] === 429, `explain limit 15/min per IP: requests 1–15 → 400 (invalid body), 16th → ${codes[15]}`);
  const codes2: number[] = [];
  for (let i = 0; i < 7; i++) codes2.push((await fetch(`${BASE}/api/lab/extract`, { method: "POST", headers: { "x-forwarded-for": ipRl } })).status);
  ok("F10", codes2.slice(0, 6).every((c) => c === 400) && codes2[6] === 429, `lab/extract limit 6/min per IP: 7th → ${codes2[6]}`);

  await pause();
  // F5 explain (AI) — last
  r = await post("/api/explain", { kind: "risk", lang: "km" });
  ok("F5", r.status === 400, `explain missing risk → ${r.status} ${(await text(r)).slice(0, 80)}`);
  if (AI || process.env.EXPECT_TEMPLATE === "1") {
    r = await post("/api/explain", {
      kind: "risk", lang: "km",
      risk: { findrisc: { score: 15, scoreMax: 15, band: "high", factors: [{ factor: "age", points: 3 }, { factor: "waist", points: 3 }], recommendGlucoseTest: true }, cvd: { available: true, band: "10-20" } },
    });
    j = JSON.parse(await text(r));
    const khmer = /[ក-៿]/.test(j.text ?? "");
    if (process.env.EXPECT_TEMPLATE === "1")
      ok("F5", r.status === 200 && khmer && j.source === "template", `explain with AI unavailable → ${r.status}, source ${j.source}, Khmer ${khmer}`);
    else
      ok("F5", r.status === 200 && khmer, `explain → ${r.status}, source ${j.source}, Khmer text ${khmer}: "${String(j.text).replaceAll("​", "").slice(0, 80)}…"`);
  }
  // F6 valid image (AI)
  if (AI) {
    const fx = fs.readdirSync("tests/fixtures/lab_reports").find((f) => f.endsWith(".png"))!;
    const img = new Blob([fs.readFileSync(`tests/fixtures/lab_reports/${fx}`)], { type: "image/png" });
    const f = new FormData();
    f.append("image", img, fx);
    r = await fetch(`${BASE}/api/lab/extract`, { method: "POST", body: f, headers: { "x-forwarded-for": `${IP}8` } });
    j = JSON.parse(await text(r));
    ok("F6", (r.status === 200 && j.values?.length > 0 && j.imageDeleted === true) || r.status === 503,
      `extract valid image (${fx}) → ${r.status}, ${j.values?.length ?? 0} values, imageDeleted ${j.imageDeleted}${r.status === 503 ? " (AI unavailable/quota — handled)" : ""}`);
  }

  // F11
  const leaks = bodies.filter((b) => STACK.test(b));
  ok("F11", leaks.length === 0, `no stack traces or internal errors in ${bodies.length} responses${leaks.length ? `: ${leaks[0].slice(0, 120)}` : ""}`);

  console.log(failures ? `\n✗ ${failures} check(s) failed` : "\n✓ all API route checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
