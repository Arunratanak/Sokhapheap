/**
 * Registry of every open dataset used by the open-data pipeline (Phase 2).
 * Approved in data/INVENTORY.md (23 Nov 2026). Each entry → one row in data/manifest.json.
 *
 * Raw files live in data/raw/opendata/<id>/ (git-ignored). Facility and boundary datasets
 * reuse the files downloaded by the facility pipeline (data/raw/admin, moh, osm).
 */
export type Level = "national" | "province" | "district" | "commune" | "grid" | "points" | "market points";

export interface RawFile {
  /** Path relative to data/raw. */
  path: string;
  /** Where to download it from (omitted for files fetched by the facility pipeline). */
  url?: string;
}

export interface Dataset {
  id: string;
  name: string;
  publisher: string;
  /** Landing page (for credits). */
  url: string;
  licence: string;
  licenceUrl?: string;
  dataYear: string;
  level: Level[];
  usedFor: string;
  files: RawFile[];
  notes?: string;
}

const DHS_INDICATORS = [
  "AN_NUTS_W_OWT", // women overweight or obese (BMI ≥ 25)
  "AH_TOBC_M_ANY", // men who smoke any tobacco
  "AH_TOBC_W_ANY", // women who smoke any tobacco
  "AH_HINS_W_NON", // women with no health insurance
  "AH_HINS_M_NON", // men with no health insurance
  "RH_PAHC_W_DIS", // women: distance to health facility is a big problem
  "HC_WIXQ_P_LOW", // population in the lowest wealth quintile
] as const;
export const DHS_INDICATOR_IDS = DHS_INDICATORS;

const dhsUrl = (breakdown: "subnational" | "national") =>
  `https://api.dhsprogram.com/rest/dhs/data?surveyIds=KH2021DHS&indicatorIds=${DHS_INDICATORS.join(",")}` +
  `&breakdown=${breakdown}&perpage=1000&f=json`;

const gho = (code: string) => `https://ghoapi.azureedge.net/api/${code}?$filter=SpatialDim%20eq%20'KHM'`;
const mapWcs = (coverage: string) =>
  `https://data.malariaatlas.org/geoserver/Accessibility/wcs?service=WCS&version=2.0.1&request=GetCoverage` +
  `&coverageId=${coverage}&subset=Long(102.3,107.7)&subset=Lat(10.4,14.7)&format=image/tiff`;

export const DATASETS: Dataset[] = [
  {
    id: "cod-ab",
    name: "Cambodia – Subnational Administrative Boundaries (COD-AB)",
    publisher: "OCHA / Ministry of Land Management, Urbanization and Construction, via HDX",
    url: "https://data.humdata.org/dataset/cod-ab-khm",
    licence: "CC BY-IGO",
    licenceUrl: "https://creativecommons.org/licenses/by/3.0/igo/",
    dataYear: "2024 (version valid 2018–2024, updated Aug 2026)",
    level: ["province", "district", "commune"],
    usedFor: "Province / district / commune polygons and P-codes; the geography every other dataset is joined to",
    files: [
      { path: "admin/khm_admin1.geojson" },
      { path: "admin/khm_admin2.geojson" },
      { path: "admin/khm_admin3.geojson" },
    ],
  },
  {
    id: "cod-ps",
    name: "Cambodia – Subnational Population Statistics (COD-PS)",
    publisher: "UNFPA / National Institute of Statistics, via HDX",
    url: "https://data.humdata.org/dataset/cod-ps-khm",
    licence: "CC BY-IGO",
    licenceUrl: "https://creativecommons.org/licenses/by/3.0/igo/",
    dataYear: "2024 (projection)",
    level: ["national", "province"],
    usedFor: "Official population totals and age structure (cross-check for WorldPop; adult share per province)",
    files: [
      {
        path: "opendata/cod-ps/khm_admpop_adm0_2024.csv",
        url: "https://data.humdata.org/dataset/770386b0-d7c6-4ea7-abbc-beccac38c192/resource/a282139b-1957-4a1f-890f-bb610f514f71/download/khm_admpop_adm0_2024.csv",
      },
      {
        path: "opendata/cod-ps/khm_admpop_adm1_2024.csv",
        url: "https://data.humdata.org/dataset/770386b0-d7c6-4ea7-abbc-beccac38c192/resource/b7476c8d-33d7-4460-9a9a-6d63ba738056/download/khm_admpop_adm1_2024.csv",
      },
    ],
  },
  {
    id: "worldpop",
    name: "WorldPop – Cambodia population counts 2025 (constrained, 100 m, R2025A)",
    publisher: "WorldPop, University of Southampton, via HDX",
    url: "https://data.humdata.org/dataset/worldpop-population-counts-2015-2030-khm",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    dataYear: "2025",
    level: ["grid"],
    usedFor: "Population per area (district/commune) and population weights for travel times",
    files: [
      {
        path: "opendata/worldpop/khm_pop_2025_CN_100m_R2025A_v1.tif",
        url: "https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2025/KHM/v1/100m/constrained/khm_pop_2025_CN_100m_R2025A_v1.tif",
      },
    ],
  },
  {
    id: "map-travel-time",
    name: "Travel time to healthcare, motorised and walking-only (Weiss et al., Nature Medicine 2020)",
    publisher: "Malaria Atlas Project",
    url: "https://data.malariaatlas.org/",
    licence: "CC BY 4.0 (TODO(VERIFY): not stated by the WCS server; confirm on malariaatlas.org)",
    dataYear: "2019 (nominal; 2020 release)",
    level: ["grid"],
    usedFor: "Population-weighted travel time to the nearest health facility; % of people > 60 min walking / > 30 min motorised",
    files: [
      { path: "opendata/map/motorized_travel_time_to_healthcare_2019.tif", url: mapWcs("Accessibility__202001_Global_Motorized_Travel_Time_to_Healthcare") },
      { path: "opendata/map/walking_travel_time_to_healthcare_2019.tif", url: mapWcs("Accessibility__202001_Global_Walking_Only_Travel_Time_To_Healthcare") },
    ],
    notes: "Clipped server-side to 102.3–107.7°E, 10.4–14.7°N via the MAP WCS.",
  },
  {
    id: "moh-facilities",
    name: "Cambodia – Health Facilities (Ministry of Health)",
    publisher: "Ministry of Health, Cambodia, via HDX",
    url: "https://data.humdata.org/dataset/cambodia-health",
    licence: "Other (not stated on HDX)",
    dataYear: "2010",
    level: ["points"],
    usedFor: "Facility counts per area, nearest hospital / health centre (via data/clean/facilities.geojson)",
    files: [
      { path: "moh/Health/khm_hltfacp_referral_gov.shp" },
      { path: "moh/Health/khm_hltfacp_healthcenter_gov.shp" },
      { path: "moh/Health/khm_hltfacp_healthpost_gov.shp" },
    ],
  },
  {
    id: "osm-facilities",
    name: "Health Facilities of Cambodia (OpenStreetMap export)",
    publisher: "Humanitarian OpenStreetMap Team, via HDX. © OpenStreetMap contributors",
    url: "https://data.humdata.org/dataset/hotosm_khm_health_facilities",
    licence: "ODbL 1.0",
    licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    dataYear: "2026 (snapshot 3 Nov 2026)",
    level: ["points"],
    usedFor: "Facility counts per area, nearest hospital / health centre (via data/clean/facilities.geojson)",
    files: [{ path: "osm/health_facilities.geojson" }],
  },
  {
    id: "dhs-2021",
    name: "Cambodia Demographic and Health Survey 2021–22 – subnational indicators (aggregated)",
    publisher: "The DHS Program (ICF) / National Institute of Statistics / Ministry of Health",
    url: "https://api.dhsprogram.com/",
    licence: "DHS Program terms: published aggregated indicators, free to use with citation (no microdata used)",
    licenceUrl: "https://dhsprogram.com/data/Terms-of-Use.cfm",
    dataYear: "2021–22",
    level: ["national", "province"],
    usedFor: "Province risk factors (women overweight/obese, smoking), access (distance problem, no insurance), poverty (lowest wealth quintile)",
    files: [
      { path: "opendata/dhs/kh2021dhs_subnational.json", url: dhsUrl("subnational") },
      { path: "opendata/dhs/kh2021dhs_national.json", url: dhsUrl("national") },
    ],
    notes: "Indicators: " + DHS_INDICATORS.join(", ") + ". Ages 15–49 only.",
  },
  {
    id: "who-gho",
    name: "WHO Global Health Observatory – Cambodia noncommunicable disease indicators",
    publisher: "World Health Organization (HDX 'Cambodia - Health Indicators' + GHO OData API)",
    url: "https://data.humdata.org/dataset/who-data-for-khm",
    licence: "CC BY-NC-SA 3.0 IGO",
    licenceUrl: "https://creativecommons.org/licenses/by-nc-sa/3.0/igo/",
    dataYear: "2019–2025 (per indicator)",
    level: ["national"],
    usedFor: "National NCD context (diabetes, hypertension, overweight, obesity, inactivity, tobacco, NCD mortality)",
    files: [
      {
        path: "opendata/who/noncommunicable_diseases_indicators_khm.csv",
        url: "https://data.humdata.org/dataset/332d719b-b3e1-4c58-8bf7-faec61e2ac85/resource/ca9aa247-df1f-4240-99d4-df3f9a09de07/download/noncommunicable_diseases_indicators_khm.csv",
      },
      { path: "opendata/who/gho_NCD_HYP_PREVALENCE_A.json", url: gho("NCD_HYP_PREVALENCE_A") },
      { path: "opendata/who/gho_NCD_HYP_DIAGNOSIS_A.json", url: gho("NCD_HYP_DIAGNOSIS_A") },
      { path: "opendata/who/gho_NCD_HYP_CONTROL_A.json", url: gho("NCD_HYP_CONTROL_A") },
    ],
  },
  {
    id: "world-bank-health",
    name: "Cambodia – Health (World Bank indicators)",
    publisher: "World Bank Group, via HDX",
    url: "https://data.humdata.org/dataset/world-bank-health-indicators-for-cambodia",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    dataYear: "to 2025 (per indicator)",
    level: ["national"],
    usedFor: "National health spending context (per capita, out-of-pocket)",
    files: [
      {
        path: "opendata/worldbank/health_khm.csv",
        url: "https://data.humdata.org/dataset/a10e7a77-0fa5-402a-9beb-821f06a2fb20/resource/4edc58db-ee3a-4a70-ac11-31f321585004/download/health_khm.csv",
      },
    ],
  },
  {
    id: "heigit-access",
    name: "Cambodia – Accessibility Indicators (primary health care and hospitals, by car)",
    publisher: "HeiGIT (Heidelberg Institute for Geoinformation Technology), via HDX",
    url: "https://data.humdata.org/dataset/cambodia-accessibility-indicators",
    licence: "CC BY-SA",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    dataYear: "2026 (Feb 2026)",
    level: ["province", "district"],
    usedFor: "Cross-check only: share of people within 30 / 60 min by car of primary health care (compared with MAP)",
    files: [
      { path: "opendata/heigit/KHM_primary_healthcare_access_wide.csv", url: "https://hot.storage.heigit.org/heigit-hdx-public/access/khm/KHM_primary_healthcare_access_wide.csv" },
    ],
  },
  {
    id: "wfp-food-prices",
    name: "Cambodia – Food Prices",
    publisher: "WFP – World Food Programme, via HDX",
    url: "https://data.humdata.org/dataset/wfp-food-prices-for-cambodia",
    licence: "CC BY-IGO",
    licenceUrl: "https://creativecommons.org/licenses/by/3.0/igo/",
    dataYear: "2025–2026 (last 12 months of data used)",
    level: ["market points", "province"],
    usedFor: "Typical local vegetable and fruit prices per province (optional diet tip). No data for Kep.",
    files: [
      {
        path: "opendata/wfp/wfp_food_prices_khm.csv",
        url: "https://data.humdata.org/dataset/086162d6-7ad7-447d-83cc-1535201aa584/resource/3ff6e50c-0e28-422f-a181-d7a17e57174a/download/wfp_food_prices_khm.csv",
      },
    ],
  },
];
