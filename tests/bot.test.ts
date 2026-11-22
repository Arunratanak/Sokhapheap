import { describe, expect, it } from "vitest";
import { addMonths, formatLabMessage, formatRiskMessage, parseBotNumber, QUESTIONS } from "@/lib/bot/bot";
import { runRiskCheck } from "@/lib/risk";
import { riskInputSchema } from "@/lib/schemas";
import { evaluateLabValue } from "@/lib/scoring/labRanges";
import { POST as telegramPOST } from "@/app/api/telegram/route";
import { POST as cronPOST } from "@/app/api/cron/reminders/route";

const answers = {
  sex: "male", age: 58, heightCm: 165, weightKg: 78, waistCm: 98, physicallyActive: false, dailyVegFruit: false,
  bpMedication: true, highGlucoseHistory: false, familyHistory: "second_degree", smoker: true, sbp: 150,
};

describe("Telegram bot", () => {
  it("asks the same questions as the web questionnaire", () => {
    expect(QUESTIONS.map((q) => q.key)).toEqual([
      "sex", "age", "heightCm", "weightKg", "waistCm", "physicallyActive", "dailyVegFruit",
      "bpMedication", "highGlucoseHistory", "familyHistory", "smoker", "sbp",
    ]);
  });

  it("uses the same scoring as the web app (same answers → same scores)", () => {
    const web = runRiskCheck(riskInputSchema.parse({ ...answers, channel: "web" }));
    const bot = runRiskCheck(riskInputSchema.parse({ ...answers, channel: "bot" }));
    expect(bot).toEqual(web);
    expect(bot.findrisc.score).toBe(15);
  });

  it("result and lab messages always include the disclaimer (km and en)", () => {
    const r = runRiskCheck(riskInputSchema.parse(answers));
    expect(formatRiskMessage(r, "km")).toContain("នេះមិនមែនជាការធ្វើរោគវិនិច្ឆ័យទេ។ សូមពិគ្រោះជាមួយវេជ្ជបណ្ឌិត។");
    expect(formatRiskMessage(r, "en")).toContain("This is not a diagnosis. Please consult a doctor.");
    expect(formatRiskMessage(r, "en")).toContain("High risk");
    const lab = [evaluateLabValue({ test_name: "FBS", value: 130, unit: "mg/dL", printed_range_low: 70, printed_range_high: 110, confidence: 0.9 })];
    expect(formatLabMessage(lab, "km")).toContain("នេះមិនមែនជាការធ្វើរោគវិនិច្ឆ័យទេ");
    expect(formatLabMessage(lab, "en")).toContain("Outside range");
  });

  it("parses numbers typed with Khmer digits", () => {
    expect(parseBotNumber("៤៥")).toBe(45);
    expect(parseBotNumber("72,5")).toBe(72.5);
    expect(parseBotNumber("abc")).toBeNull();
  });

  it("reminder dates", () => {
    expect(addMonths(new Date("2026-12-26T00:00:00Z"), 6)).toBe("2027-06-26");
    expect(addMonths(new Date("2026-12-26T00:00:00Z"), 12)).toBe("2027-12-26");
  });
});

describe("protected endpoints", () => {
  it("telegram webhook rejects requests without the secret token", async () => {
    const res = await telegramPOST(new Request("http://test/api/telegram", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
    const wrong = await telegramPOST(new Request("http://test/api/telegram", {
      method: "POST", body: "{}", headers: { "x-telegram-bot-api-secret-token": "wrong" },
    }));
    expect(wrong.status).toBe(401);
  });

  it("cron endpoint rejects requests without CRON_SECRET", async () => {
    expect((await cronPOST(new Request("http://test/api/cron/reminders", { method: "POST" }))).status).toBe(401);
    expect((await cronPOST(new Request("http://test/api/cron/reminders", { method: "POST", headers: { "x-cron-secret": "nope" } }))).status).toBe(401);
  });
});
