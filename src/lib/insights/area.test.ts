import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { areaSummary, areaOptions, locatePoint } from "./area";
import { GET as areaGET } from "@/app/api/area/route";
import { formatAreaMessage } from "@/lib/bot/bot";

const districts = JSON.parse(fs.readFileSync("data/clean/areas_district.json", "utf8")).areas as {
  pcode: string; name_en: string; province_pcode: string; travel_motor_mean_min: number; pct_walk_over_60_min: number;
  dhs: Record<string, number | null>;
}[];

// Checkpoint 5: five test locations (town centres).
const PLACES = [
  { name: "Phnom Penh", lat: 11.5564, lng: 104.9282, province: "KH12" },
  { name: "Siem Reap", lat: 13.3633, lng: 103.8564, province: "KH17" },
  { name: "Battambang", lat: 13.0957, lng: 103.2022, province: "KH02" },
  { name: "Sen Monorom (Mondulkiri)", lat: 12.4558, lng: 107.1881, province: "KH11" },
  { name: "Koh Kong town", lat: 11.6153, lng: 102.9838, province: "KH09" },
];

describe("Your area: location lookup", () => {
  for (const p of PLACES) {
    it(`${p.name} → province ${p.province}, numbers match data/clean`, () => {
      const hit = locatePoint(p.lat, p.lng);
      expect(hit?.province).toBe(p.province);
      const s = areaSummary({ lat: p.lat, lng: p.lng })!;
      const d = districts.find((x) => x.pcode === hit!.district)!;
      expect(s.district.pcode).toBe(d.pcode);
      expect(s.travelMotorMin).toBe(d.travel_motor_mean_min);
      expect(s.pctWalkOver60).toBe(d.pct_walk_over_60_min);
      expect(s.womenOverweightPct).toBe(d.dhs.women_overweight_or_obese_pct);
      expect(s.nearestHealthCentre?.from).toBe("you");
      expect(s.nearestHealthCentre!.km).toBeLessThan(30);
    });
  }

  it("a point in the sea or outside Cambodia finds no area", () => {
    expect(locatePoint(10.0, 103.0)).toBeNull(); // Gulf of Thailand
    expect(areaSummary({ lat: 13.75, lng: 100.5 })).toBeNull(); // Bangkok
  });

  it("dropdowns (district P-code) give the same area numbers as the location", () => {
    for (const p of PLACES) {
      const byPoint = areaSummary({ lat: p.lat, lng: p.lng })!;
      const byDropdown = areaSummary({ district: byPoint.district.pcode })!;
      const pick = (s: typeof byPoint) => ({ province: s.province, district: s.district, ow: s.womenOverweightPct, smoke: s.menSmokePct, motor: s.travelMotorMin, walk: s.pctWalkOver60 });
      expect(pick(byDropdown)).toEqual(pick(byPoint));
    }
  });

  it("dropdown options list all 25 provinces and 197 districts", () => {
    const o = areaOptions();
    expect(o).toHaveLength(25);
    expect(o.reduce((n, p) => n + p.districts.length, 0)).toBe(197);
  });
});

describe("Your area: privacy and API", () => {
  it("the API response never contains the user's coordinates and is not cacheable", async () => {
    const res = await areaGET(new Request("http://test/api/area?lat=11.55641&lng=104.92821"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.text();
    expect(body).not.toContain("11.5564");
    expect(body).not.toContain("104.9282");
  });
  it("rejects bad input with 400 and unknown areas with 404", async () => {
    expect((await areaGET(new Request("http://test/api/area?lat=abc&lng=1"))).status).toBe(400);
    expect((await areaGET(new Request("http://test/api/area?district=Phnom%20Penh"))).status).toBe(400);
    expect((await areaGET(new Request("http://test/api/area?district=KH9999"))).status).toBe(404);
    expect((await areaGET(new Request("http://test/api/area?lat=10&lng=103"))).status).toBe(404);
  });
  it("the area code never stores anything (no database or file writes)", () => {
    const src = fs.readFileSync("src/lib/insights/area.ts", "utf8") + fs.readFileSync("src/app/api/area/route.ts", "utf8");
    expect(src).not.toMatch(/insert\(|upsert\(|writeFile|console\.log|getServiceClient/);
  });
});

describe("Your area: wording and bot", () => {
  it("bot message uses the same numbers, describes the area (not the person) and names sources", () => {
    const s = areaSummary({ lat: 12.4558, lng: 107.1881 })!;
    const msg = formatAreaMessage(s, "en");
    expect(msg).toContain(`about ${s.womenOverweightPct}% of women aged 15–49`);
    expect(msg).toContain(`${Math.round(s.travelMotorMin!)} minutes by car or motorbike`);
    expect(msg).toContain("DHS 2021–22");
    expect(msg).toContain("not you personally");
    expect(msg).not.toMatch(/\byou (are|have) (at risk|a high)/i);
  });
  it("Khmer message uses Khmer digits", () => {
    const s = areaSummary({ district: "KH1201" })!;
    expect(formatAreaMessage(s, "km")).toMatch(/[០-៩]/);
  });
  it("no area text says the person is at risk because of their area", () => {
    for (const lang of ["en", "km"]) {
      const a = JSON.parse(fs.readFileSync(`src/lib/i18n/${lang}.json`, "utf8")).area;
      const all = JSON.stringify(a);
      expect(all).not.toMatch(/you are at risk|because your (province|district)|your risk is/i);
    }
  });
});
