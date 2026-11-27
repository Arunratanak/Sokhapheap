import { describe, expect, it } from "vitest";
import { computeGapIndex, getField, makeScaler, percentile, spearman, type AreaRecord } from "./gapIndex";
import { GAP_INDEX_COMPONENTS, type ComponentDef } from "./gapIndexConfig";

const ind = (field: string, direction: "higher_is_worse" | "lower_is_worse" = "higher_is_worse") => ({
  field, direction, label: { en: field, km: field }, source: "test", year: "2025", level: "district" as const,
});
const comps = (wA = 1, wB = 1): ComponentDef[] => [
  { id: "access", label: { en: "A", km: "A" }, weight: wA, indicators: [ind("a")] },
  { id: "capacity", label: { en: "B", km: "B" }, weight: wB, indicators: [ind("b", "lower_is_worse")] },
];
const area = (pcode: string, a: number | null, b: number | null): AreaRecord => ({ pcode, name_en: pcode, a, b });

describe("normalisation", () => {
  it("percentile interpolates", () => {
    expect(percentile([0, 10], 0.5)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4, 5], 1)).toBe(5);
  });
  it("plain min-max maps min → 0 and max → 1", () => {
    const s = makeScaler([10, 20, 30], [0, 1]);
    expect([s(10), s(20), s(30)]).toEqual([0, 0.5, 1]);
  });
  it("percentile capping keeps outliers from squashing the rest", () => {
    const vals = [...Array.from({ length: 99 }, (_, i) => i + 1), 10000]; // 1..99 plus one extreme outlier
    const plain = makeScaler(vals, [0, 1]);
    const capped = makeScaler(vals, [0.05, 0.95]);
    expect(plain(90)).toBeLessThan(0.01); // squashed by the outlier
    expect(capped(90)).toBeGreaterThan(0.9);
    expect(capped(10000)).toBe(1); // clipped
    expect(capped(-5)).toBe(0);
  });
  it("inverts 'lower is worse' indicators", () => {
    const s = makeScaler([0, 10], [0, 1], true);
    expect([s(0), s(10)]).toEqual([1, 0]);
  });
  it("no spread → 0 for everyone (cannot rank)", () => {
    const s = makeScaler([5, 5, 5], [0, 1]);
    expect(s(5)).toBe(0);
  });
  it("getField reads nested paths and rejects non-numbers", () => {
    expect(getField({ dhs: { x: 3 } }, "dhs.x")).toBe(3);
    expect(getField({ dhs: null }, "dhs.x")).toBeNull();
    expect(getField({ x: "3" }, "x")).toBeNull();
  });
});

describe("weighting and ranking", () => {
  const areas = [area("A", 0, 10), area("B", 10, 0), area("C", 5, 5)];

  it("equal weights: weighted average of component scores, 0–100", () => {
    const r = computeGapIndex(areas, comps(), [0, 1]);
    // A: access 0, capacity (inverted, 10 = best) 0 → 0 · B: 1 and 1 → 100 · C: 0.5 and 0.5 → 50
    expect(r.map((x) => [x.pcode, x.index, x.rank])).toEqual([["B", 100, 1], ["C", 50, 2], ["A", 0, 3]]);
  });

  it("weights change the result as specified", () => {
    const two = [area("A", 10, 10), area("B", 0, 0)]; // A: access 1, capacity 0 · B: access 0, capacity 1
    const r = computeGapIndex(two, comps(3, 1), [0, 1]);
    expect(r.find((x) => x.pcode === "A")!.index).toBe(75); // (3×1 + 1×0) / 4
    expect(r.find((x) => x.pcode === "B")!.index).toBe(25);
    expect(r[0].pcode).toBe("A");
  });

  it("a component with weight 0 is excluded from the index but still reported", () => {
    const r = computeGapIndex(areas, comps(1, 0), [0, 1]);
    expect(r.find((x) => x.pcode === "C")!.index).toBe(50);
    expect(r.find((x) => x.pcode === "A")!.components.capacity).toBe(0);
  });

  it("missing values are skipped, not treated as 0", () => {
    const r = computeGapIndex([area("A", 10, null), area("B", 0, 0), area("C", 5, 10)], comps(), [0, 1]);
    expect(r.find((x) => x.pcode === "A")!.index).toBe(100); // only access counts
    expect(r.find((x) => x.pcode === "A")!.components.capacity).toBeNull();
  });

  it("ties are broken by P-code so the ranking is deterministic", () => {
    const r = computeGapIndex([area("Z", 5, 5), area("M", 5, 5)], comps(), [0, 1]);
    expect(r.map((x) => x.pcode)).toEqual(["M", "Z"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2]);
  });

  it("drivers = top components by weight × score, only those above 0", () => {
    const r = computeGapIndex(areas, comps(), [0, 1]);
    expect(r.find((x) => x.pcode === "B")!.drivers).toEqual(["access", "capacity"]);
    expect(r.find((x) => x.pcode === "A")!.drivers).toEqual([]);
  });

  it("spearman is 1 for identical rankings and -1 for reversed", () => {
    const a = computeGapIndex(areas, comps(), [0, 1]);
    expect(spearman(a, a)).toBe(1);
    const rev = a.map((x) => ({ ...x, rank: a.length + 1 - x.rank }));
    expect(spearman(a, rev)).toBe(-1);
  });
});

describe("configuration", () => {
  it("has the 5 approved components with positive default (equal) weights", () => {
    expect(GAP_INDEX_COMPONENTS.map((c) => c.id)).toEqual(["risk", "access", "capacity", "people", "poverty"]);
    expect(new Set(GAP_INDEX_COMPONENTS.map((c) => c.weight))).toEqual(new Set([1]));
    expect(GAP_INDEX_COMPONENTS.every((c) => c.indicators.length > 0 && c.indicators.every((i) => i.label.km && i.source))).toBe(true);
  });
});
