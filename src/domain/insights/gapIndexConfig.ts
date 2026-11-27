/**
 * Screening Gap Index — configuration (weights, components and normalisation).
 *
 * WHAT IT IS: a planning tool that ranks areas by where NCD screening could help most — many adults,
 * more risk factors, far from care, few facilities, more poverty. It is NOT a measure of anyone's health.
 *
 * FORMULA (per area, computed separately for districts and for provinces):
 *   1. Each indicator x is capped to the 5th–95th percentile of all areas (so a few extreme areas don't
 *      squash everyone else), then min-max scaled to 0–1:  s = (x − p5) / (p95 − p5), clipped to [0, 1].
 *      "Lower is worse" indicators (facilities per 10,000) are inverted: s = 1 − s.
 *   2. Component score = mean of its indicators' scores (0–1).
 *   3. Index = 100 × Σ(weight × component score) / Σ(weight)  → 0–100. Higher = bigger screening gap.
 *   4. Rank 1 = highest index. Top 3 drivers = the components with the largest weight × score.
 *   Missing values: the indicator is skipped and the remaining ones are averaged (none are missing in
 *   the current data; the pipeline reports it if that changes).
 *
 * DATA LEVEL: DHS indicators (risk, poverty, distance problem) exist only per province, so all districts
 * of a province share those values; travel time, facilities and population are per district.
 * Communes are not indexed because three of the five components would be province-level copies.
 */

export type ComponentId = "risk" | "access" | "capacity" | "people" | "poverty";
export type Direction = "higher_is_worse" | "lower_is_worse";

export interface IndicatorDef {
  /** Path in the areas_*.json record, e.g. "dhs.men_smoke_tobacco_pct". */
  field: string;
  label: { en: string; km: string };
  direction: Direction;
  source: string; // manifest dataset id
  year: string;
  level: "district" | "province";
}

export interface ComponentDef {
  id: ComponentId;
  label: { en: string; km: string };
  weight: number;
  indicators: IndicatorDef[];
}

/** Percentile caps used before min-max scaling (set to [0, 1] for plain min-max). */
export const GAP_INDEX_CLIP: [number, number] = [0.05, 0.95];

export const GAP_INDEX_COMPONENTS: ComponentDef[] = [
  {
    id: "risk",
    label: { en: "Risk factors", km: "កត្តាហានិភ័យ" },
    weight: 1,
    indicators: [
      { field: "dhs.women_overweight_or_obese_pct", label: { en: "Women overweight or obese (15–49)", km: "ស្ត្រីលើសទម្ងន់ ឬធាត់ (១៥–៤៩ ឆ្នាំ)" }, direction: "higher_is_worse", source: "dhs-2021", year: "2021–22", level: "province" },
      { field: "dhs.men_smoke_tobacco_pct", label: { en: "Men who smoke (15–49)", km: "បុរសជក់បារី (១៥–៤៩ ឆ្នាំ)" }, direction: "higher_is_worse", source: "dhs-2021", year: "2021–22", level: "province" },
      { field: "dhs.women_smoke_tobacco_pct", label: { en: "Women who smoke (15–49)", km: "ស្ត្រីជក់បារី (១៥–៤៩ ឆ្នាំ)" }, direction: "higher_is_worse", source: "dhs-2021", year: "2021–22", level: "province" },
    ],
  },
  {
    id: "access",
    label: { en: "Distance to care", km: "ចម្ងាយទៅកន្លែងព្យាបាល" },
    weight: 1,
    indicators: [
      { field: "travel_motor_mean_min", label: { en: "Average travel time by car or motorbike", km: "រយៈពេលធ្វើដំណើរជាមធ្យមដោយរថយន្ត ឬម៉ូតូ" }, direction: "higher_is_worse", source: "map-travel-time", year: "2019", level: "district" },
      { field: "pct_walk_over_60_min", label: { en: "People more than 1 hour's walk from care", km: "មនុស្សដែលដើរលើសពី ១ ម៉ោងទៅកន្លែងព្យាបាល" }, direction: "higher_is_worse", source: "map-travel-time", year: "2019", level: "district" },
      { field: "dhs.women_distance_is_problem_pct", label: { en: "Women who say distance is a problem", km: "ស្ត្រីដែលថាចម្ងាយជាបញ្ហា" }, direction: "higher_is_worse", source: "dhs-2021", year: "2021–22", level: "province" },
    ],
  },
  {
    id: "capacity",
    label: { en: "Few facilities", km: "កន្លែងព្យាបាលតិច" },
    weight: 1,
    indicators: [
      { field: "facilities_per_10k", label: { en: "Health facilities per 10,000 people", km: "កន្លែងព្យាបាលក្នុងមនុស្ស ១០.០០០ នាក់" }, direction: "lower_is_worse", source: "moh-facilities + osm-facilities", year: "2010 + 2026", level: "district" },
    ],
  },
  {
    id: "people",
    label: { en: "Many adults", km: "មនុស្សពេញវ័យច្រើន" },
    weight: 1,
    indicators: [
      { field: "adults_20plus_est", label: { en: "Adults aged 20+ (estimate)", km: "មនុស្សពេញវ័យអាយុ ២០ ឆ្នាំឡើង (ប៉ាន់ស្មាន)" }, direction: "higher_is_worse", source: "worldpop + cod-ps", year: "2025 / 2024", level: "district" },
    ],
  },
  {
    id: "poverty",
    label: { en: "Poverty", km: "ភាពក្រីក្រ" },
    weight: 1,
    indicators: [
      { field: "dhs.population_lowest_wealth_quintile_pct", label: { en: "People in the poorest fifth of households", km: "មនុស្សក្នុងក្រុមគ្រួសារក្រីក្របំផុត ២០%" }, direction: "higher_is_worse", source: "dhs-2021", year: "2021–22", level: "province" },
    ],
  },
];
