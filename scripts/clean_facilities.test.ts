import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAMBODIA_BBOX, dedupe, haversineMeters, osmType, type Facility } from "./clean_facilities";

const f = (over: Partial<Facility>): Facility => ({
  id: "x", name: "x", name_km: null, type: "hospital", province: null, district: null,
  lat: 11.5564, lng: 104.9282, source: "osm", ...over,
});

describe("facility cleaning helpers", () => {
  it("haversine: 0.001° latitude ≈ 111 m", () => {
    expect(haversineMeters(11.5, 104.9, 11.501, 104.9)).toBeCloseTo(111.2, 0);
  });

  it("maps OSM tags and excludes pharmacies/dentists", () => {
    expect(osmType("hospital", null)).toBe("hospital");
    expect(osmType(null, "hospital")).toBe("hospital");
    expect(osmType("clinic", null)).toBe("clinic");
    expect(osmType("doctors", null)).toBe("clinic");
    expect(osmType(null, "health_center")).toBe("health_centre");
    expect(osmType("pharmacy", "pharmacy")).toBeNull();
    expect(osmType("dentist", null)).toBeNull();
    expect(osmType(null, null)).toBeNull();
  });

  it("dedupe keeps the first record (OSM) and removes same-type within 200 m only", () => {
    const osm = f({ id: "osm", source: "osm" });
    const mohNear = f({ id: "moh", source: "moh_2010", lat: 11.5574 }); // ~111 m
    const mohFar = f({ id: "moh2", source: "moh_2010", lat: 11.5594 }); // ~333 m
    const otherType = f({ id: "hc", type: "health_centre", lat: 11.5565 });
    const { kept, removed } = dedupe([osm, mohNear, mohFar, otherType]);
    expect(kept.map((k) => k.id)).toEqual(["osm", "moh2", "hc"]);
    expect(removed).toBe(1);
  });
});

const CLEAN = path.resolve(__dirname, "../data/clean/facilities.geojson");

describe.runIf(fs.existsSync(CLEAN))("clean facilities output (checkpoint 2)", () => {
  const facilities: Facility[] = JSON.parse(fs.readFileSync(CLEAN, "utf8")).features.map(
    (x: { properties: Facility }) => x.properties,
  );

  it("has a plausible number of facilities covering all 25 provinces", () => {
    expect(facilities.length).toBeGreaterThan(300);
    expect(facilities.length).toBeLessThan(5000);
    expect(new Set(facilities.map((x) => x.province)).size).toBe(25);
  });

  it("every facility is inside Cambodia with required fields", () => {
    const b = CAMBODIA_BBOX;
    for (const x of facilities) {
      expect(x.lat).toBeGreaterThanOrEqual(b.minLat);
      expect(x.lat).toBeLessThanOrEqual(b.maxLat);
      expect(x.lng).toBeGreaterThanOrEqual(b.minLng);
      expect(x.lng).toBeLessThanOrEqual(b.maxLng);
      expect(x.name).toBeTruthy();
      expect(x.province).toBeTruthy();
      expect(["moh_2010", "osm"]).toContain(x.source);
    }
  });

  it("no duplicates of the same type within 200 m remain", () => {
    const { removed } = dedupe(facilities, 200);
    expect(removed).toBe(0);
  });
});
