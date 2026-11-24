import "server-only";
import fs from "node:fs";
import path from "node:path";
import { nearestLocal } from "./facilities";
import { runModules, MODULES } from "./modules/registry";
import { profileSchema } from "./modules/profile";
import { evaluateLabValue, type LabFlag } from "./scoring/labRanges";
import { waistInchesToCm } from "./units";
import { manifest } from "./insights/data";

/**
 * Example content for the home-page hero cards, computed with the app's real logic (not typed by hand),
 * so the examples always match what the app would output. Tested in heroExamples.test.ts.
 */

// ---------------------------------------------------------------- slide 1: Dara, 45, Phnom Penh
/** Example person: man, 45, 168 cm, 62 kg (BMI 22), waist 33 in, never smoked, BP 142/92, no medicine, active, eats vegetables, no family diabetes; a cough now. */
export const DARA = {
  profile: {
    age: 45, sex: "male" as const, heightCm: 168, weightKg: 62, waistCm: waistInchesToCm(33), smokingStatus: "never" as const,
    cigarettesPerDay: null, smokingYears: null, sbp: 142, dbp: 92, bpMedication: false, knownDiabetes: false, knownHighBp: false,
    knownHeartDisease: false, knownKidneyDisease: false, familyDiabetes: "none" as const, pregnant: null, province: "Phnom Penh", district: null,
  },
  answers: {
    findrisc: { physicallyActive: true, dailyVegFruit: true, highGlucoseHistory: false },
    tb_symptom: { tbCough: true, tbCoughBlood: false, tbFever: false, tbNightSweats: false, tbWeightLoss: false, tbContact: false },
  },
  screenings: ["who_cvd", "findrisc", "bp_check", "tb_symptom"],
  /** Wat Phnom, central Phnom Penh: where the "nearest health centre" distance is measured from. */
  location: { lat: 11.5765, lng: 104.9231 },
};

export function riskExample() {
  const profile = profileSchema.parse(DARA.profile);
  const cards = runModules(profile, DARA.screenings, DARA.answers, MODULES);
  const get = (id: string) => cards.find((c) => c.moduleId === id)!.result!;
  const heart = get("who_cvd");
  const nearest = nearestLocal(DARA.location.lat, DARA.location.lng, 400).find((f) => f.type === "health_centre");
  return {
    screenings: DARA.screenings.length,
    heartPercent: heart.score!, heartBand: heart.band, heartUrgency: heart.urgency,
    diabetes: { band: get("findrisc").band, urgency: get("findrisc").urgency },
    bp: { sbp: profile.sbp!, dbp: profile.dbp!, band: get("bp_check").band, urgency: get("bp_check").urgency, next: get("bp_check").nextStepKey },
    tb: { band: get("tb_symptom").band, urgency: get("tb_symptom").urgency, next: get("tb_symptom").nextStepKey },
    nearestHealthCentreKm: nearest ? Math.round(nearest.distance_m / 100) / 10 : null,
  };
}

// ---------------------------------------------------------------- slide 2: example lab report
/** Example lab rows. Creatinine has no single guideline range, so (like a real report) it carries the lab's printed range. */
export const LAB_ROWS = [
  { key: "glucose", test_name: "Fasting blood sugar", value: 92, unit: "mg/dL", low: null, high: null },
  { key: "cholesterol", test_name: "Total cholesterol", value: 228, unit: "mg/dL", low: null, high: null },
  { key: "hba1c", test_name: "HbA1c", value: 5.4, unit: "%", low: null, high: null },
  { key: "creatinine", test_name: "Creatinine", value: 0.9, unit: "mg/dL", low: 0.7, high: 1.3 },
] as const;

export function labExample(): { key: (typeof LAB_ROWS)[number]["key"]; value: number; unit: string; flag: LabFlag; direction?: "low" | "high" }[] {
  return LAB_ROWS.map((r) => {
    const e = evaluateLabValue({ test_name: r.test_name, value: r.value, unit: r.unit, printed_range_low: r.low, printed_range_high: r.high, confidence: 0.95 });
    return { key: r.key, value: r.value, unit: r.unit, flag: e.flag, direction: e.direction };
  });
}

// ---------------------------------------------------------------- slide 3: distance by district
type Commune = { district_pcode: string; population: number; nearest_health_centre?: { km: number | null } | null };
const readClean = <T,>(f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/clean", f), "utf8")) as T;

/**
 * Population-weighted average straight-line distance (km) from commune centres to the nearest health centre,
 * by district, for one province; plus national counts. Source: data/clean/areas_*.json (open-data pipeline).
 */
export function distanceExample(provinceName = "Koh Kong") {
  const communes = readClean<{ areas: Commune[] }>("areas_commune.json").areas;
  const districts = readClean<{ areas: { pcode: string; name_en: string; province_pcode: string }[] }>("areas_district.json").areas;
  const province = readClean<{ areas: { pcode: string; name_en: string }[] }>("areas_province.json").areas.find((p) => p.name_en === provinceName)!;
  const bars = districts
    .filter((d) => d.province_pcode === province.pcode)
    .map((d) => {
      const cs = communes.filter((c) => c.district_pcode === d.pcode && c.nearest_health_centre?.km != null && c.population > 0);
      const pop = cs.reduce((s, c) => s + c.population, 0);
      const km = cs.reduce((s, c) => s + c.nearest_health_centre!.km! * c.population, 0) / pop;
      return { name: d.name_en, km: Math.round(km * 10) / 10 };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const top = bars.reduce((a, b) => (b.km > a.km ? b : a));
  return {
    province: province.name_en,
    bars,
    top,
    communes: communes.length,
    peopleOver10km: Math.round(communes.filter((c) => (c.nearest_health_centre?.km ?? 0) > 10).reduce((s, c) => s + (c.population || 0), 0)),
    datasets: manifest().length,
  };
}
