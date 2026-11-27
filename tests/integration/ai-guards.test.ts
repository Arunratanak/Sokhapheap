import { describe, expect, it } from "vitest";
import { isCleanKhmerOrLatin } from "@/server/ai/gemini";
import { isUnsafe } from "@/server/ai/explain";
import { parseExtraction } from "@/server/ai/extract";

describe("AI output guards", () => {
  it("rejects Thai or Thaana characters mixed into Khmer (seen in real flash-lite output)", () => {
    expect(isCleanKhmerOrLatin("ពិន្ទុរបស់អ្នកស្ថិតក្នុងកម្រិតខ្ពស់។ Score 15/26 — 10% 🙂")).toBe(true);
    expect(isCleanKhmerOrLatin("កត្តាចម្បងគឺទំហំรอบเอว អាយុ")).toBe(false); // Thai
    expect(isCleanKhmerOrLatin("អេម៉ូក្លូប៊ីនអޭវ៉ាន់ស៊ី")).toBe(false); // Thaana
    expect(isCleanKhmerOrLatin("µmol/L")).toBe(true);
  });

  it("flags drug names, doses and diagnoses", () => {
    expect(isUnsafe("Take 500 mg metformin twice a day.")).toBe(true);
    expect(isUnsafe("You have diabetes.")).toBe(true);
    expect(isUnsafe("អ្នកមានជំងឺទឹកនោមផ្អែម")).toBe(true);
    expect(isUnsafe("Your fasting glucose is 130 mg/dL, which is outside the range. Please see a doctor.")).toBe(false);
  });

  it("parses model JSON robustly and rejects garbage", () => {
    expect(parseExtraction('```json\n[{"test_name":"FBS","value":"5,6","unit":"mmol/L","printed_range_low":null,"printed_range_high":null,"confidence":0.9}]\n```'))
      .toEqual([{ test_name: "FBS", value: 5.6, unit: "mmol/L", printed_range_low: null, printed_range_high: null, confidence: 0.9 }]);
    expect(parseExtraction('{"results":[{"test_name":"HbA1c","value":6.1,"unit":"%","confidence":0.8}]}')?.[0].value).toBe(6.1);
    expect(parseExtraction("I'm sorry, I can't read this.")).toBeNull();
    expect(parseExtraction("[]")).toEqual([]);
  });
});
