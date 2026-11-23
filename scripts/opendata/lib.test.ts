import { describe, expect, it } from "vitest";
import {
  addCell, cellIndex, emptyAcc, haversineKm, makeProvinceMatcher, median, mergeAcc, parseCsv, pearson,
  pointInRings, rasterize, round, stableStringify, summarise, type Grid, type Ring,
} from "./lib";

// 10 × 10 grid of 1° cells covering lng 0–10, lat 0–10 (north edge at 10).
const grid: Grid = { ox: 0, oy: 10, res: 1, width: 10, height: 10 };
const square = (x0: number, y0: number, x1: number, y1: number): Ring => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];

describe("rasterize (cell centres inside polygon)", () => {
  it("fills exactly the cells whose centre is inside a square", () => {
    const cells: string[] = [];
    const n = rasterize([square(2, 2, 5, 4)], grid, (r, c) => cells.push(`${r},${c}`));
    // lng 2–5 → cols 2,3,4 (centres 2.5, 3.5, 4.5); lat 2–4 → rows 6,7 (centres 3.5, 2.5)
    expect(n).toBe(6);
    expect(cells.sort()).toEqual(["6,2", "6,3", "6,4", "7,2", "7,3", "7,4"]);
  });

  it("respects holes (even-odd rule)", () => {
    const cells: string[] = [];
    rasterize([square(0, 0, 5, 5), square(1, 1, 4, 4)], grid, (r, c) => cells.push(`${r},${c}`));
    expect(cells).toHaveLength(25 - 9);
    expect(cells).not.toContain("7,2"); // centre (2.5, 2.5) is in the hole
  });

  it("never writes outside the grid", () => {
    const cells: number[][] = [];
    rasterize([square(-5, -5, 20, 20)], grid, (r, c) => cells.push([r, c]));
    expect(cells).toHaveLength(100);
    expect(cells.every(([r, c]) => r >= 0 && r < 10 && c >= 0 && c < 10)).toBe(true);
  });
});

describe("geometry helpers", () => {
  it("point in polygon with a hole", () => {
    const rings = [square(0, 0, 5, 5), square(1, 1, 4, 4)];
    expect(pointInRings(0.5, 0.5, rings)).toBe(true);
    expect(pointInRings(2.5, 2.5, rings)).toBe(false);
    expect(pointInRings(6, 6, rings)).toBe(false);
  });
  it("cellIndex", () => {
    expect(cellIndex(grid, 0.5, 9.5)).toBe(0);
    expect(cellIndex(grid, 9.5, 0.5)).toBe(99);
    expect(cellIndex(grid, -1, 5)).toBe(-1);
  });
  it("haversine: Phnom Penh → Siem Reap ≈ 230 km straight line", () => {
    const d = haversineKm(11.5564, 104.9282, 13.3633, 103.8564);
    expect(d).toBeGreaterThan(225);
    expect(d).toBeLessThan(235);
  });
});

describe("population-weighted travel time", () => {
  it("weights by population and counts people over the thresholds", () => {
    const a = emptyAcc();
    addCell(a, 100, 10, 30); // 100 people: 10 min motor, 30 min walk
    addCell(a, 300, 50, 120); // 300 people: 50 min motor, 120 min walk
    addCell(a, 50, null, null); // 50 people where the travel layer has no data
    const s = summarise(a);
    expect(s.population).toBe(450);
    expect(s.travel_motor_mean_min).toBe(40); // (100×10 + 300×50) / 400
    expect(s.travel_walk_mean_min).toBe(97.5); // (100×30 + 300×120) / 400
    expect(s.pct_walk_over_60_min).toBe(75); // 300 / 400
    expect(s.pct_motor_over_30_min).toBe(75);
  });
  it("merging accumulators equals accumulating everything at once", () => {
    const a = emptyAcc(), b = emptyAcc(), all = emptyAcc();
    addCell(a, 10, 5, 70); addCell(b, 30, 45, 20);
    addCell(all, 10, 5, 70); addCell(all, 30, 45, 20);
    mergeAcc(a, b);
    expect(summarise(a)).toEqual(summarise(all));
  });
  it("an area without people has null travel values, not 0", () => {
    expect(summarise(emptyAcc())).toMatchObject({ population: 0, travel_motor_mean_min: null, pct_walk_over_60_min: null });
  });
});

describe("name matching", () => {
  const match = makeProvinceMatcher([
    { pcode: "KH09", name: "Koh Kong" }, { pcode: "KH22", name: "Oddar Meanchey" }, { pcode: "KH17", name: "Siemreap" },
    { pcode: "KH16", name: "Ratanak Kiri" }, { pcode: "KH12", name: "Phnom Penh" },
  ]);
  it("matches exact names, DHS '..' prefixes and documented aliases", () => {
    expect(match("Phnom Penh")).toBe("KH12");
    expect(match("..Kaoh Kong")).toBe("KH09");
    expect(match("..Otdar Mean Chey")).toBe("KH22");
    expect(match("Siem Reap")).toBe("KH17");
    expect(match("....Ratanak Kiri")).toBe("KH16");
    expect(match("Ratanakiri Province")).toBe("KH16");
  });
  it("returns null (to be reported) for combined regions and unknown names", () => {
    expect(match("Siem Reap/Otdar Mean Chey")).toBeNull();
    expect(match("Atlantis")).toBeNull();
  });
});

describe("small utilities", () => {
  it("round", () => {
    expect(round(1.25, 1)).toBe(1.3);
    expect(round(-0.01, 1)).toBe(0);
    expect(round(null)).toBeNull();
    expect(round(Number.NaN)).toBeNull();
  });
  it("median and pearson", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
  });
  it("parseCsv handles quotes and commas", () => {
    expect(parseCsv('a,b\n"x, y","He said ""hi"""\n')).toEqual([["a", "b"], ["x, y", 'He said "hi"']]);
  });
  it("stableStringify sorts keys", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}\n');
  });
});
