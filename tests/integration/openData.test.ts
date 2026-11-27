import { describe, expect, it } from "vitest";
import { createBot, getSession } from "@/server/bot/bot";
import { areaSummary, matchProvinceName } from "@/server/insights/area";
import { GET as areaGET } from "@/app/api/area/route";
import { GET as areasGET } from "@/app/api/open-data/areas/route";
import { GET as areaByPcodeGET } from "@/app/api/open-data/areas/[pcode]/route";
import { GET as sourcesGET } from "@/app/api/open-data/sources/route";

// ---------- Telegram bot /area, driven offline (fake Telegram API, nothing is sent) ----------
function fakeBot(chatId: number) {
  const b = createBot("123456:TEST");
  b.botInfo = { id: 1, is_bot: true, first_name: "T", username: "t_bot", can_join_groups: false, can_read_all_group_messages: false,
    supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false } as never;
  const sent: string[] = [];
  b.api.config.use(async (_prev, method, payload) => {
    if (method === "sendMessage") sent.push((payload as { text: string }).text);
    return { ok: true, result: { message_id: sent.length, date: 0, chat: { id: chatId, type: "private" }, text: "" } } as never;
  });
  const chat = { id: chatId, type: "private" as const, first_name: "T" };
  const from = { id: chatId, is_bot: false, first_name: "T" };
  let uid = 1;
  const send = (extra: Record<string, unknown>) =>
    b.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat, from, ...extra } } as never);
  return {
    sent,
    command: (c: string) => send({ text: c, entities: [{ type: "bot_command", offset: 0, length: c.length }] }),
    text: (t: string) => send({ text: t }),
    location: (latitude: number, longitude: number) => send({ location: { latitude, longitude } }),
  };
}

const PLACES = [
  { name: "Phnom Penh", lat: 11.5564, lng: 104.9282 },
  { name: "Siem Reap", lat: 13.3633, lng: 103.8564 },
  { name: "Sen Monorom", lat: 12.4558, lng: 107.1881 },
];

describe("Checkpoint 7 — bot /area matches the web numbers", () => {
  for (const [i, p] of PLACES.entries()) {
    it(`${p.name}: /area + location → same numbers as GET /api/area`, async () => {
      const bot = fakeBot(800000 + i);
      getSession(800000 + i).lang = "en";
      await bot.command("/area");
      expect(bot.sent[0]).toContain("send your location, or type your province");
      await bot.location(p.lat, p.lng);
      const msg = bot.sent.find((s) => s.startsWith("📊 Your area") && s.includes("% of women"))!;
      expect(msg).toBeTruthy();
      const web = await (await areaGET(new Request(`http://t/api/area?lat=${p.lat}&lng=${p.lng}`))).json();
      expect(msg).toContain(`${web.district.name}, ${web.province.name}`);
      expect(msg).toContain(`about ${web.womenOverweightPct}% of women aged 15–49`);
      expect(msg).toContain(`about ${web.menSmokePct}% of men aged 15–49 smoke`);
      expect(msg).toContain(`${Math.round(web.travelMotorMin)} minutes by car or motorbike`);
      expect(msg).toContain(`about ${Math.round(web.pctWalkOver60)}% live more than an hour's walk`);
      expect(getSession(800000 + i).step).toBeNull();
    });
  }

  it("typing a province (English or Khmer) gives the province summary; unknown text asks again", async () => {
    const bot = fakeBot(800100);
    getSession(800100).lang = "km";
    await bot.command("/area");
    await bot.text("Atlantis");
    expect(bot.sent.at(-1)).toContain("រកមិនឃើញខេត្ត");
    await bot.text("សៀមរាប");
    const msg = bot.sent.at(-1)!;
    const s = areaSummary({ province: "KH17" })!;
    expect(msg).toContain("Siemreap");
    expect(msg).toMatch(/[០-៩]/);
    expect(s.travelMotorMin).not.toBeNull();
    expect(getSession(800100).step).toBeNull();
  });

  it("province names: English, common spellings and Khmer", () => {
    expect(matchProvinceName("Siem Reap")).toBe("KH17");
    expect(matchProvinceName("siemreap province")).toBe("KH17");
    expect(matchProvinceName("Ratanakiri")).toBe("KH16");
    expect(matchProvinceName("Sihanoukville")).toBe("KH18");
    expect(matchProvinceName("ខេត្តតាកែវ")).toBe("KH21");
    expect(matchProvinceName("រាជធានីភ្នំពេញ")).toBe("KH12");
    expect(matchProvinceName("hello")).toBeNull();
  });
});

describe("Checkpoint 7 — public open-data API", () => {
  const req = (url: string, ip = "10.0.0.1") => new Request(`http://t${url}`, { headers: { "x-forwarded-for": ip } });

  it("GET /api/open-data/areas?level=province → 25 areas, licence, citation, cache headers", async () => {
    const res = await areasGET(req("/api/open-data/areas?level=province"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/public, max-age=\d+/);
    const j = await res.json();
    expect(j.licence).toBe("CC BY 4.0");
    expect(j.citation).toMatch(/SokhaPheap open data/);
    expect(j.count).toBe(25);
    expect(j.data[0]).toHaveProperty("travel_motor_mean_min");
    expect(j.data[0]).toHaveProperty("gap.index");
  });

  it("district level → 197 areas; bad level → 400", async () => {
    expect((await (await areasGET(req("/api/open-data/areas?level=district"))).json()).count).toBe(197);
    expect((await areasGET(req("/api/open-data/areas?level=village"))).status).toBe(400);
  });

  it("GET /api/open-data/areas/{pcode} for province, district and commune; unknown → 404", async () => {
    const get = (pc: string) => areaByPcodeGET(req(`/api/open-data/areas/${pc}`), { params: Promise.resolve({ pcode: pc }) } as never);
    const prov = await (await get("KH12")).json();
    expect([prov.level, prov.data.name_en]).toEqual(["province", "Phnom Penh"]);
    const dist = await (await get("KH1901")).json();
    expect([dist.level, dist.data.gap.rank > 0]).toEqual(["district", true]);
    const comm = await get("KH120102");
    expect((await comm.json()).data.nearest_health_centre.name).toBeTruthy();
    expect((await get("KH9999")).status).toBe(404);
    expect((await get("Phnom")).status).toBe(404);
  });

  it("GET /api/open-data/sources → every dataset with licence", async () => {
    const j = await (await sourcesGET(req("/api/open-data/sources"))).json();
    expect(j.count).toBeGreaterThanOrEqual(11);
    expect(j.data.every((d: { licence: string; url: string }) => d.licence && d.url)).toBe(true);
    expect(JSON.stringify(j)).not.toMatch(/TODO/);
  });

  it("rate limit: the 61st request in a minute from one user gets 429", async () => {
    let last = 200;
    for (let i = 0; i < 61; i++) last = (await sourcesGET(req("/api/open-data/sources", "10.9.9.9"))).status;
    expect(last).toBe(429);
  });
});
