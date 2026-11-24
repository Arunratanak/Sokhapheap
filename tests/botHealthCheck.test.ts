/**
 * The multi-screening health check in the Telegram bot, driven through the real bot handlers with a fake
 * Telegram API. Proves the bot gives exactly the same results as the web /check page (same module code).
 */
import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/en.json";
import km from "@/lib/i18n/km.json";
import { CHOOSE_LANGUAGE, createBot, getSession } from "@/lib/bot/bot";
import { buildProfile, formatHealthCheckMessage, PROFILE_STEPS } from "@/lib/bot/healthCheck";
import { runModules, visibleModules } from "@/lib/modules/registry";
import { waistInchesToCm } from "@/lib/units";

function fakeChat(chatId: number) {
  const b = createBot("123456:TEST");
  b.botInfo = { id: 1, is_bot: true, first_name: "Test", username: "test_bot", can_join_groups: false,
    can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false,
    has_main_web_app: false } as never;
  const sent: { text: string; buttons: string[] }[] = [];
  b.api.config.use(async (_prev, method, payload) => {
    if (method === "sendMessage") {
      const p = payload as { text: string; reply_markup?: { inline_keyboard?: { text: string; callback_data?: string }[][] } };
      sent.push({ text: p.text, buttons: (p.reply_markup?.inline_keyboard ?? []).flat().map((k) => `${k.text}=${k.callback_data}`) });
    }
    return { ok: true, result: method === "sendMessage" ? { message_id: sent.length, date: 0, chat: { id: chatId, type: "private" }, text: "" } : true } as never;
  });
  getSession(chatId).lang = "en";
  getSession(chatId).langChosen = true; // a returning user (the first /start asks for a language)
  const chat = { id: chatId, type: "private" as const, first_name: "T" };
  const from = { id: chatId, is_bot: false, first_name: "T" };
  let uid = 1;
  const text = (t: string) => b.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat, from, text: t,
    ...(t.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: t.length }] } : {}) } } as never);
  const tap = (data: string) => b.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from, chat_instance: "x", data,
    message: { message_id: uid, date: 0, chat, text: "" } } } as never);
  return { sent, text, tap };
}

describe("Telegram bot: language choice", () => {
  it("first /start asks English or Khmer; choosing one shows the welcome and menu in that language", async () => {
    const { sent, text, tap } = fakeChat(9101);
    getSession(9101).langChosen = false; // brand-new user
    await text("/start");
    expect(sent[0].text).toBe(CHOOSE_LANGUAGE);
    expect(sent[0].buttons).toEqual(["English=lang:en", "ខ្មែរ=lang:km"]);
    await tap("lang:km");
    expect(getSession(9101).lang).toBe("km");
    expect(sent[1].text).toContain(km.bot.welcome);
    expect(sent[1].buttons.join(" ")).toContain(km.bot.menuHealth);
    await text("/start"); // chosen: not asked again
    expect(sent[2].text).toContain(km.bot.welcome);
  });

  it("the menu button and /language show the picker; switching changes every later message", async () => {
    const { sent, text, tap } = fakeChat(9102);
    await text("/start");
    expect(sent[0].buttons.join(" ")).toContain("menu:lang");
    await tap("menu:lang");
    expect(sent[1].text).toBe(CHOOSE_LANGUAGE);
    await tap("lang:km");
    await text("/help");
    expect(sent.at(-1)!.text).toContain(km.bot.help);
    await text("/language");
    expect(sent.at(-1)!.text).toBe(CHOOSE_LANGUAGE);
    await tap("lang:en");
    await text("/help");
    expect(sent.at(-1)!.text).toContain(en.bot.help);
  });

  it("switching language mid-check starts fresh instead of mixing languages", async () => {
    const { text, tap } = fakeChat(9103);
    await text("/health");
    await tap("hu:no");
    expect(getSession(9103).hc).toBeDefined();
    await tap("lang:km");
    expect(getSession(9103).hc).toBeUndefined();
    expect(getSession(9103).step).toBeNull();
  });
});

describe("Telegram bot: health check", () => {
  it("menu leads with the health check and has no separate Find care button; help has no /near", async () => {
    const { sent, text } = fakeChat(9001);
    await text("/start");
    const buttons = sent[0].buttons.join(" | ");
    expect(buttons).toContain("menu:health");
    expect(buttons).not.toContain("menu:near");
    expect(en.bot.help).toContain("/health");
    expect(en.bot.help).not.toContain("/near");
  });

  it("full conversation gives exactly the web results (same module code)", async () => {
    const { sent, text, tap } = fakeChat(9002);
    await text("/health");
    await tap("hu:no");
    // Profile: man, 61, 165 cm, 70 kg, waist 34 in, current smoker, BP 125/80, no medicine, no conditions, no family diabetes.
    await tap("hp:sex:male");
    for (const v of ["61", "165", "70", "34"]) await text(v);
    await tap("hp:smokingStatus:current");
    await text("125");
    await text("80");
    await tap("hp:bpMedication:0");
    for (const k of ["knownDiabetes", "knownHighBp", "knownHeartDisease", "knownKidneyDisease"]) await tap(`hp:${k}:0`);
    await tap("hp:familyDiabetes:none");
    // Choose: add the opt-in lab-based heart check, then continue.
    const choose = sent.at(-1)!;
    expect(choose.text).toContain(en.bot.hcChoose);
    expect(choose.buttons.some((b) => b.includes("who_cvd_lab"))).toBe(true);
    await tap("hs:t:who_cvd_lab");
    await tap("hs:go");
    // Lab heart: cholesterol 162 mg/dL (unit asked only after the number), blood sugar test normal.
    await text("162");
    expect(sent.at(-1)!.text).toContain(en.check.cvdLab.unit.q);
    await tap("hq:who_cvd_lab:cholesterolUnit:mg/dL");
    await tap("hq:who_cvd_lab:glucoseTest:normal");
    // FINDRISC questions, then TB (no symptoms, no contact).
    for (const q of ["physicallyActive", "dailyVegFruit", "highGlucoseHistory"]) await tap(`hq:findrisc:${q}:1`);
    for (const q of ["tbCough", "tbCoughBlood", "tbFever", "tbNightSweats", "tbWeightLoss", "tbContact"]) await tap(`hq:tb_symptom:${q}:0`);

    // Same computation as the web page, from the same answers.
    const profile = buildProfile({
      sex: "male", age: 61, heightCm: 165, weightKg: 70, waistCm: waistInchesToCm(34), smokingStatus: "current",
      sbp: 125, dbp: 80, bpMedication: false, knownDiabetes: false, knownHighBp: false, knownHeartDisease: false,
      knownKidneyDisease: false, familyDiabetes: "none",
    });
    expect(profile.success).toBe(true);
    const selected = ["bp_check", "who_cvd", "findrisc", "tb_symptom", "who_cvd_lab"];
    const answers = {
      who_cvd_lab: { totalCholesterol: 162, cholesterolUnit: "mg/dL", glucoseTest: "normal" },
      findrisc: { physicallyActive: true, dailyVegFruit: true, highGlucoseHistory: true },
      tb_symptom: { tbCough: false, tbCoughBlood: false, tbFever: false, tbNightSweats: false, tbWeightLoss: false, tbContact: false },
    };
    const expected = formatHealthCheckMessage(runModules(profile.data!, selected, answers, visibleModules(false)), "en", true);
    const all = sent.map((m) => m.text).join("\n\n");
    for (const block of expected) expect(all).toContain(block);
    expect(all).toContain("Score: 11%"); // lab-based heart risk, same as the web e2e test
    expect(all).toContain(en.check.draftBanner);
    expect(all).toContain(en.common.disclaimer);
    expect(sent.at(-1)!.text).toBe(en.bot.sendLocationPrompt); // find care is part of the result
  });

  it("the blood pressure medicine question has a 'What does this mean?' button with the WHO examples", async () => {
    const { sent, tap } = fakeChat(9003);
    const q = PROFILE_STEPS.find((p) => p.key === "bpMedication");
    expect(q && "info" in q && q.info).toBeTruthy();
    await tap("info:bpmeds");
    expect(sent.at(-1)!.text).toContain("amlodipine");
  });

  it("asks pregnancy only to women 15–49, and the bottom BP number only when the top is known", () => {
    const keys = (d: Record<string, unknown>) => PROFILE_STEPS.filter((p) => !p.when || p.when(d)).map((p) => p.key);
    expect(keys({ sex: "female", age: 30 })).toContain("pregnant");
    expect(keys({ sex: "female", age: 60 })).not.toContain("pregnant");
    expect(keys({ sex: "male", age: 30 })).not.toContain("pregnant");
    expect(keys({ sbp: null })).not.toContain("dbp");
    expect(keys({ sbp: 130 })).toContain("dbp");
  });
});
