import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Log in with Telegram" + saved records, end to end against an in-memory stand-in for the Supabase client
 * (the test config has no database). Covers: website start → bot confirm → website poll → session →
 * save / list / delete records, plus the security edges (wrong token, reuse, someone else's record).
 */

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
let nextId = 1;

class Query implements PromiseLike<{ data: unknown; error: null }> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | null = null;
  private filters: ((r: Row) => boolean)[] = [];
  private returning = false;
  private one: "single" | "maybe" | null = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private max = Infinity;
  constructor(private table: string) {}
  select() { if (this.op !== "select") this.returning = true; return this; }
  insert(row: Row) { this.op = "insert"; this.payload = row; return this; }
  update(v: Row) { this.op = "update"; this.payload = v; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  gt(c: string, v: string) { this.filters.push((r) => String(r[c]) > v); return this; }
  lt(c: string, v: string) { this.filters.push((r) => String(r[c]) < v); return this; }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  order(col: string, o: { ascending: boolean }) { this.orderBy = { col, asc: o.ascending }; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }
  private run(): unknown {
    const rows = (tables[this.table] ??= []);
    const match = rows.filter((r) => this.filters.every((f) => f(r)));
    let out: Row[];
    if (this.op === "insert") {
      const defaults: Row = this.table === "login_requests" ? { status: "pending" } : {}; // column defaults (0004_telegram_login.sql)
      const row: Row = { id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`, created_at: new Date(Date.now() + nextId).toISOString(), ...defaults, ...this.payload };
      if (this.table === "login_requests" && rows.some((r) => r.link_hash === row.link_hash)) throw new Error("duplicate");
      rows.push(row);
      out = [row];
      if (!this.returning) return null;
    } else if (this.op === "update") {
      for (const r of match) Object.assign(r, this.payload);
      out = match;
      if (!this.returning) return null;
    } else if (this.op === "delete") {
      tables[this.table] = rows.filter((r) => !match.includes(r));
      out = match;
      if (!this.returning) return null;
    } else {
      out = [...match];
      if (this.orderBy) {
        const { col, asc } = this.orderBy;
        out.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1));
      }
      out = out.slice(0, this.max);
    }
    return this.one ? (out[0] ?? null) : out;
  }
  then<A = { data: unknown; error: null }, B = never>(
    ok?: ((v: { data: unknown; error: null }) => A | PromiseLike<A>) | null,
    fail?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve().then(() => ({ data: this.run(), error: null as null })).then(ok, fail);
  }
}

vi.mock("@/server/db/supabase", () => ({
  getServiceClient: () => ({ from: (t: string) => new Query(t) }),
  getAnonClient: () => null,
  withTimeout: <T,>(p: PromiseLike<T>) => Promise.resolve(p),
}));

const { startLogin, answerLogin, findPendingLogin, pollLogin, LOGIN_START_PREFIX } = await import("@/server/auth/telegramLogin");
const records = await import("@/app/api/records/route");
const recordById = await import("@/app/api/records/[id]/route");
const { riskRecord, labRecord, healthCheckRecord, recordInputSchema } = await import("@/domain/records");
const { runRiskCheck } = await import("@/domain/risk");
const { riskInputSchema } = await import("@/domain/schemas");
const { evaluateLabValue } = await import("@/domain/scoring/labRanges");
const { formatRecordsMessage } = await import("@/server/bot/records");

const ALICE = 111_222_333;
const BOB = 444_555_666;
const risk = runRiskCheck(riskInputSchema.parse({
  sex: "male", age: 58, heightCm: 165, weightKg: 78, waistCm: 98, physicallyActive: false, dailyVegFruit: false,
  bpMedication: true, highGlucoseHistory: false, familyHistory: "second_degree", smoker: true, sbp: 150,
}));

/** Website start → bot confirm → website poll. Returns the session token. */
async function login(userId: number, firstName = "Dara") {
  const s = await startLogin();
  if (!s.ok) throw new Error("start failed");
  const linkToken = new URL(s.url).searchParams.get("start")!.slice(LOGIN_START_PREFIX.length);
  expect(await findPendingLogin(linkToken)).toEqual({ code: s.code });
  expect(await answerLogin(linkToken, { id: userId, firstName }, true)).toBe(true);
  const p = await pollLogin(s.pollToken);
  if (p.status !== "confirmed") throw new Error(`poll: ${p.status}`);
  return { token: p.token, name: p.name, s, linkToken };
}
const req = (token: string | null, init: RequestInit = {}) =>
  new Request("http://test/api/records", { ...init, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" } });

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  process.env.TELEGRAM_BOT_USERNAME = "sokhapheap_test_bot";
});

describe("Log in with Telegram", () => {
  it("start gives a t.me link to the bot, a 4-digit code and a poll token; only hashes are stored", async () => {
    const s = await startLogin();
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.url).toMatch(/^https:\/\/t\.me\/sokhapheap_test_bot\?start=login_[A-Za-z0-9_-]{43}$/);
    expect(new URL(s.url).searchParams.get("start")!.length).toBeLessThanOrEqual(64); // Telegram's limit
    expect(s.code).toMatch(/^\d{4}$/);
    const row = tables.login_requests[0];
    expect(JSON.stringify(row)).not.toContain(s.pollToken);
    expect(JSON.stringify(row)).not.toContain(new URL(s.url).searchParams.get("start")!.slice(6));
    expect(await pollLogin(s.pollToken)).toEqual({ status: "pending" });
  });

  it("confirming in the bot logs the browser in; the request can't be used twice", async () => {
    const { token, name, s, linkToken } = await login(ALICE);
    expect(name).toBe("Dara");
    expect(tables.login_requests).toHaveLength(0); // first name deleted with the request
    expect(tables.user_sessions).toHaveLength(1);
    expect(tables.user_sessions[0].telegram_user_id).toBe(ALICE);
    expect(JSON.stringify(tables.user_sessions)).not.toContain(token);
    expect(await pollLogin(s.pollToken)).toEqual({ status: "expired" });
    expect(await answerLogin(linkToken, { id: BOB }, true)).toBe(false);
  });

  it("cancel in the bot, expired requests and bad tokens never give a session", async () => {
    const s = await startLogin();
    if (!s.ok) throw new Error();
    const link = new URL(s.url).searchParams.get("start")!.slice(6);
    expect(await answerLogin(link, { id: ALICE }, false)).toBe(true);
    expect(await pollLogin(s.pollToken)).toEqual({ status: "denied" });

    const late = await startLogin(Date.now() - 11 * 60 * 1000); // already past its 10 minutes
    if (!late.ok) throw new Error();
    expect(await answerLogin(new URL(late.url).searchParams.get("start")!.slice(6), { id: ALICE }, true)).toBe(false);
    expect(await pollLogin(late.pollToken)).toEqual({ status: "expired" });

    expect(await pollLogin("not-a-token")).toEqual({ status: "expired" });
    expect(await answerLogin("x".repeat(43), { id: ALICE }, true)).toBe(false);
    expect(tables.user_sessions ?? []).toHaveLength(0);
  });
});

describe("records API", () => {
  it("needs a valid session", async () => {
    expect((await records.GET(req(null))).status).toBe(401);
    expect((await records.GET(req("A".repeat(43)))).status).toBe(401);
    expect((await records.POST(req(null, { method: "POST", body: JSON.stringify(riskRecord(risk)) }))).status).toBe(401);
  });

  it("saves, lists (newest first), and deletes only the owner's records", async () => {
    const alice = await login(ALICE);
    const lab = labRecord([evaluateLabValue({ test_name: "FBS", value: 130, unit: "mg/dL", printed_range_low: 70, printed_range_high: 110, confidence: 1 })]);
    for (const rec of [riskRecord(risk), lab]) {
      const res = await records.POST(req(alice.token, { method: "POST", body: JSON.stringify(rec) }));
      expect(res.status).toBe(201);
    }
    const list = await (await records.GET(req(alice.token))).json();
    expect(list.records.map((r: { kind: string }) => r.kind)).toEqual(["lab", "risk"]);
    expect(list.records[0].channel).toBe("web");

    // Bob can't see or delete Alice's records.
    const bob = await login(BOB, "Sok");
    expect((await (await records.GET(req(bob.token))).json()).records).toEqual([]);
    const id = list.records[0].id;
    await recordById.DELETE(req(bob.token, { method: "DELETE" }), { params: Promise.resolve({ id }) });
    expect((await (await records.GET(req(alice.token))).json()).records).toHaveLength(2);

    await recordById.DELETE(req(alice.token, { method: "DELETE" }), { params: Promise.resolve({ id }) });
    expect((await (await records.GET(req(alice.token))).json()).records).toHaveLength(1);
  });

  it("rejects records that don't match the schema", async () => {
    const { token } = await login(ALICE);
    const bad = [{ kind: "risk", data: { findrisc: { score: 99 } } }, { kind: "notes", data: "hello" }, { kind: "lab", data: { values: [] } }];
    for (const b of bad) expect((await records.POST(req(token, { method: "POST", body: JSON.stringify(b) }))).status).toBe(400);
  });

  it("delete all removes every record and logs out every browser", async () => {
    const a1 = await login(ALICE);
    const a2 = await login(ALICE);
    await records.POST(req(a1.token, { method: "POST", body: JSON.stringify(riskRecord(risk)) }));
    expect((await records.DELETE(req(a1.token, { method: "DELETE" }))).status).toBe(200);
    expect(tables.health_records).toHaveLength(0);
    expect((await records.GET(req(a2.token))).status).toBe(401);
  });
});

describe("record format", () => {
  it("builders produce valid records with no answers in them", () => {
    const r = riskRecord(risk);
    expect(recordInputSchema.safeParse(r).success).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/weightKg|heightCm|waistCm|"age":|"sbp":/);
    const hc = healthCheckRecord([
      { moduleId: "findrisc", healthArea: "metabolic", redFlag: false, result: { score: 15, band: "moderate", urgency: "moderate", factors: [{ factor: "bmi" }], nextStepKey: "results.nextSteps.glucose_test", facilityType: "health_centre" } },
      { moduleId: "tb_symptom", healthArea: "lungs", redFlag: true, result: null },
    ]);
    expect(recordInputSchema.safeParse(hc).success).toBe(true);
    if (hc.kind === "health_check") expect(hc.data.cards[1].urgency).toBe("red_flag");
  });

  it("bot /records text has the dates, labels, a link to the website and the disclaimer (km and en)", () => {
    const saved = [{ ...riskRecord(risk), id: "1", createdAt: "2026-11-27T03:00:00Z", channel: "bot" as const }];
    const en = formatRecordsMessage(saved, "en", "https://example.org/");
    expect(en).toContain("2026-11-27");
    expect(en).toContain("Diabetes and heart risk");
    expect(en).toContain("https://example.org/en/account");
    expect(en).toContain("This is not a diagnosis. Please consult a doctor.");
    const km = formatRecordsMessage(saved, "km", "https://example.org");
    expect(km).toContain("២០២៦");
    expect(formatRecordsMessage([], "en")).toMatch(/no saved records/i);
  });
});
