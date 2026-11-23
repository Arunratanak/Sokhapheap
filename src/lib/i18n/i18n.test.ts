import { describe, expect, it } from "vitest";
import km from "./km.json";
import en from "./en.json";
import { addKhmerLineBreaks, getDictionary, getRawDictionary, hasLocale } from "./index";

function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object"
      ? keyPaths(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe("i18n", () => {
  it("km and en have exactly the same keys", () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(km).sort());
  });

  it("Khmer disclaimer matches the required wording exactly", () => {
    expect(km.common.disclaimer).toBe(
      "នេះមិនមែនជាការធ្វើរោគវិនិច្ឆ័យទេ។ សូមពិគ្រោះជាមួយវេជ្ជបណ្ឌិត។",
    );
  });

  it("recognises supported locales only", () => {
    expect(hasLocale("km")).toBe(true);
    expect(hasLocale("en")).toBe(true);
    expect(hasLocale("fr")).toBe(false);
    expect(getRawDictionary("km").common.appName).toBe("សុខភាព");
  });

  it("adds invisible line-break hints between Khmer words only", () => {
    const out = addKhmerLineBreaks("ពិនិត្យហានិភ័យរបស់ខ្ញុំ");
    expect(out).toContain("​");
    expect(out.replaceAll("​", "")).toBe("ពិនិត្យហានិភ័យរបស់ខ្ញុំ");
    expect(addKhmerLineBreaks("Check my risk")).toBe("Check my risk");
    expect(getDictionary("km").common.disclaimer.replaceAll("​", "")).toBe(
      km.common.disclaimer,
    );
  });
});

describe("dictionary arrays", () => {
  it("Khmer line-break processing keeps arrays as arrays (CSV headers, API field lists)", () => {
    const km = getDictionary("km");
    expect(Array.isArray(km.planner.csvHeader)).toBe(true);
    expect(Array.isArray(km.apiDocs.fields)).toBe(true);
    expect(km.planner.csvHeader.join(",")).toMatch(/^plan_order,district,/);
  });
});
