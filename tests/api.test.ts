import { describe, expect, it } from "vitest";
import { POST as riskPOST } from "@/app/api/risk/route";
import { GET as nearestGET } from "@/app/api/facilities/nearest/route";
import { GET as byAreaGET } from "@/app/api/facilities/by-area/route";
import { GET as areasGET } from "@/app/api/facilities/areas/route";
import { POST as explainPOST } from "@/app/api/explain/route";
import { POST as evaluatePOST } from "@/app/api/lab/evaluate/route";
import { POST as extractPOST } from "@/app/api/lab/extract/route";
import { GET as healthGET } from "@/app/api/health/route";
import { calculateFindrisc } from "@/lib/scoring/findrisc";
import { calculateWhoCvd } from "@/lib/scoring/whoCvd";

const json = (url: string, body: unknown, ip = "1.1.1.1") =>
  new Request(`http://test${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const person = {
  age: 58, sex: "male", heightCm: 165, weightKg: 78, waistCm: 98, physicallyActive: false, dailyVegFruit: false,
  bpMedication: true, highGlucoseHistory: false, familyHistory: "second_degree", smoker: true, sbp: 150, save: false,
};

describe("POST /api/risk", () => {
  it("returns identical scores to the unit-tested functions", async () => {
    const res = await riskPOST(json("/api/risk", person));
    expect(res.status).toBe(200);
    const body = await res.json();
    const f = calculateFindrisc(person as never);
    expect(body.findrisc).toEqual(f);
    expect(body.cvd).toEqual(calculateWhoCvd({ age: 58, sex: "male", smoker: true, sbp: 150, bmi: f.bmi }));
    // Hand check: age 3 + BMI 28.7→1 + waist 98→3 + inactive 2 + diet 1 + BP meds 2 + family 3 = 15
    expect(body.findrisc.score).toBe(15);
    expect(body.findrisc.band).toBe("high");
    expect(body.nextStep).toBe("see_doctor_soon");
    expect(body.saved).toBe(false);
  });

  it("unknown blood pressure → CVD unavailable and 'check BP' style result", async () => {
    const res = await riskPOST(json("/api/risk", { ...person, sbp: null, age: 30, bpMedication: false, waistCm: 80, familyHistory: "none" }));
    const body = await res.json();
    expect(body.cvd).toEqual({ available: false, reason: "age_out_of_range" });
    const res2 = await riskPOST(json("/api/risk", { ...person, sbp: null, age: 45, bpMedication: false, waistCm: 80, familyHistory: "none", physicallyActive: true, dailyVegFruit: true }));
    const b2 = await res2.json();
    expect(b2.cvd).toEqual({ available: false, reason: "bp_unknown" });
    expect(b2.nextStep).toBe("check_bp");
  });

  it("invalid input → 400 with field messages, never a crash", async () => {
    for (const bad of [{ ...person, age: 5 }, { ...person, sex: "x" }, {}, "not json"]) {
      const res = await riskPOST(json("/api/risk", bad));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBeTruthy();
    }
  });
});

describe("GET /api/facilities/*", () => {
  it("nearest to Phnom Penh (11.5564, 104.9282) returns 5 sensible results", async () => {
    const res = await nearestGET(new Request("http://test/api/facilities/nearest?lat=11.5564&lng=104.9282&limit=5"));
    const { facilities } = await res.json();
    expect(facilities).toHaveLength(5);
    for (const f of facilities) {
      expect(f.province).toBe("Phnom Penh");
      expect(f.distance_m).toBeLessThan(3000);
    }
    expect(facilities.map((f: { distance_m: number }) => f.distance_m)).toEqual(
      [...facilities.map((f: { distance_m: number }) => f.distance_m)].sort((a, b) => a - b),
    );
  });

  it("type filter returns only hospitals", async () => {
    const res = await nearestGET(new Request("http://test/api/facilities/nearest?lat=11.5564&lng=104.9282&limit=3&type=hospital"));
    const { facilities } = await res.json();
    expect(facilities.every((f: { type: string }) => f.type === "hospital")).toBe(true);
  });

  it("rejects coordinates outside Cambodia and bad params with 400", async () => {
    for (const q of ["lat=48.8&lng=2.3", "lat=abc&lng=104", "lat=11.5", "lat=11.5&lng=104.9&limit=500"])
      expect((await nearestGET(new Request(`http://test/api/facilities/nearest?${q}`))).status).toBe(400);
  });

  it("by-area works for a province and district, and rejects unknown areas", async () => {
    const all = await (await byAreaGET(new Request("http://test/api/facilities/by-area?province=Kampot"))).json();
    expect(all.facilities.length).toBeGreaterThan(10);
    const district = all.facilities[0].district;
    const one = await (await byAreaGET(new Request(`http://test/api/facilities/by-area?province=Kampot&district=${encodeURIComponent(district)}`))).json();
    expect(one.facilities.every((f: { district: string }) => f.district === district)).toBe(true);
    expect((await byAreaGET(new Request("http://test/api/facilities/by-area?province=Atlantis"))).status).toBe(400);
    expect((await byAreaGET(new Request("http://test/api/facilities/by-area"))).status).toBe(400);
  });

  it("areas lists all 25 provinces", async () => {
    const { areas } = await (await areasGET()).json();
    expect(areas).toHaveLength(25);
  });
});

describe("POST /api/lab/evaluate", () => {
  it("flags values using the shared lab range logic", async () => {
    const res = await evaluatePOST(json("/api/lab/evaluate", {
      values: [
        { test_name: "FBS", value: 132, unit: "mg/dL", printed_range_low: 70, printed_range_high: 110, confidence: 0.95 },
        { test_name: "HbA1c", value: 5.4, unit: "%", printed_range_low: null, printed_range_high: null, confidence: 0.9 },
        { test_name: "Platelets", value: 250, unit: "10^3/uL", printed_range_low: 150, printed_range_high: 400, confidence: 0.9 },
      ],
    }));
    const { results } = await res.json();
    expect(results.map((r: { flag: string }) => r.flag)).toEqual(["outside_range", "normal", "could_not_read"]);
  });

  it("400 on empty or malformed input", async () => {
    expect((await evaluatePOST(json("/api/lab/evaluate", { values: [] }))).status).toBe(400);
    expect((await evaluatePOST(json("/api/lab/evaluate", { values: [{ test_name: "x" }] }))).status).toBe(400);
  });
});

describe("POST /api/explain (AI disabled → template fallback)", () => {
  const risk = {
    findrisc: { score: 15, scoreMax: 15, band: "high", factors: [{ factor: "waist", points: 3 }, { factor: "age", points: 3 }], recommendGlucoseTest: true },
    cvd: { available: true, band: "20-30" },
  };

  it("returns Khmer template text ending with the next step", async () => {
    const res = await explainPOST(json("/api/explain", { lang: "km", kind: "risk", risk }, "2.2.2.2"));
    const body = await res.json();
    expect(body.source).toBe("template");
    expect(body.text).toContain("ហានិភ័យខ្ពស់");
    expect(body.text.endsWith("សូមបង្ហាញលទ្ធផលនេះដល់ពួកគេ។")).toBe(true);
  });

  it("lab explanation in English", async () => {
    const res = await explainPOST(json("/api/explain", {
      lang: "en", kind: "lab",
      lab: [{ test: "Fasting blood glucose", value: 132, unit: "mg/dL", flag: "outside_range", direction: "high" }],
    }, "2.2.2.3"));
    const body = await res.json();
    expect(body.text).toContain("Fasting blood glucose");
    expect(body.text).toMatch(/doctor/);
  });

  it("400 when required data is missing or extra personal data is sent in the wrong shape", async () => {
    expect((await explainPOST(json("/api/explain", { lang: "km", kind: "risk" }, "2.2.2.4"))).status).toBe(400);
    expect((await explainPOST(json("/api/explain", { lang: "fr", kind: "risk", risk }, "2.2.2.4"))).status).toBe(400);
  });

  it("rate-limits AI routes per IP (429)", async () => {
    let last = 200;
    for (let i = 0; i < 20; i++) last = (await explainPOST(json("/api/explain", { lang: "en", kind: "risk", risk }, "9.9.9.9"))).status;
    expect(last).toBe(429);
  });
});

describe("POST /api/lab/extract", () => {
  const form = (file?: File) => {
    const fd = new FormData();
    if (file) fd.set("image", file);
    return new Request("http://test/api/lab/extract", { method: "POST", body: fd, headers: { "x-forwarded-for": "3.3.3.3" } });
  };

  it("400 without an image or with a non-image file", async () => {
    expect((await extractPOST(form())).status).toBe(400);
    expect((await extractPOST(form(new File(["hello"], "a.txt", { type: "text/plain" })))).status).toBe(400);
  });

  it("503 ai_unavailable (not a crash) when AI is not configured; image is discarded", async () => {
    const res = await extractPOST(form(new File([new Uint8Array([0xff, 0xd8, 0xff])], "r.jpg", { type: "image/jpeg" })));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "ai_unavailable", imageDeleted: true });
  });
});

describe("GET /api/health", () => {
  it("returns 200 with facility count", async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    expect((await res.json()).facilities).toBeGreaterThan(1000);
  });
});
