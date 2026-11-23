# Open Data Inventory (Phase 1)

I checked this on **23 November 2026** by querying the HDX, DHS Program, WHO GHO, Malaria Atlas Project and Open Development Cambodia APIs, and by downloading and opening the files. Nothing was guessed: every value below was read from a downloaded file or an API response. Raw downloads are in `data/raw/inventory/`, which git ignores.

✅ available · ⚠️ partly available or has a caveat · ❌ not available

## 1. All datasets

| # | Dataset | Status | Exact source | Licence | Data year | Geographic level | What it contains (checked) | Size | Problems |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Health facilities (MoH) | ✅ already used | HDX `cambodia-health` → `health_facility.zip` | "Other" on HDX (not stated) ⚠️ | 2010 | Points | Referral hospitals, health centres, health posts | 95 KB | 16 years old. Licence not stated. Facility codes are not unique (fixed in our pipeline). |
| 2 | Health facilities (OSM) | ✅ already used | HDX `hotosm_khm_health_facilities` (GeoJSON) | ODbL | Snapshot 3 Nov 2026 | Points | Hospitals, clinics and more | 100 KB | Some places are mislabelled (offices tagged as hospitals). |
| 3 | Admin boundaries (COD-AB) | ✅ | HDX `cod-ab-khm`: `khm_admin_boundaries.geojson.zip` (also SHP, GDB, XLSX) | CC BY-IGO | Valid 2018 to 2024 versions, updated Aug 2026 | Province / district / commune | **25 provinces, 197 districts, 1,633 communes**, with P-codes (`KH01`, `KH0102`, `KH010203`), centroids and areas. Counted from the XLSX. | 3.0 MB zipped GeoJSON | None. The commune file needs simplifying for the web. |
| 4 | Population statistics (COD-PS) | ⚠️ | HDX `cod-ps-khm`: `khm_admpop_adm0_2024.csv`, `khm_admpop_adm1_2024.csv`, `khm_admpop_2024.xlsx` | CC BY-IGO | 2024 (projection, UNFPA) | **National + province only** | Total, plus female and male by 5-year age groups. National total **17,336,307**. | 23 KB | **No district or commune population.** The 2024 XLSX has only the ADM0 and ADM1 sheets. District and commune totals must come from WorldPop (#7). |
| 5 | DHS 2021–22 subnational indicators | ⚠️ | HDX `dhs-subnational-data-for-cambodia` (topic CSVs) plus the DHS Program API `api.dhsprogram.com/rest/dhs/data?surveyIds=KH2021DHS&breakdown=subnational` (**aggregated indicators only, no microdata**) | "Other" on HDX. DHS terms allow published aggregated indicators with citation. | Survey KH2021DHS, 2021–22 | **25 provinces** (as sub-rows of 14 survey regions) | See the DHS table below: women's BMI (overweight/obese), smoking (women and men), no health insurance, "distance is a problem", wealth quintile | ~25 MB for all topic CSVs | **No blood pressure or blood sugar indicators** for adults. BMI is for **women 15–49 only** (no men). All figures are for **ages 15–49 only**. About 250–700 respondents per province; confidence intervals are not in the files. |
| 6 | Travel time to healthcare (MAP, Weiss et al. 2020) | ✅ | Malaria Atlas Project WCS: `Accessibility__202001_Global_Motorized_Travel_Time_to_Healthcare` and `…_Walking_Only_Travel_Time_To_Healthcare`, clipped to Cambodia (102.3–107.7°E, 10.4–14.7°N) | **To confirm.** Your prompt says CC BY 4.0, but the map server's metadata doesn't state a licence. I'll check malariaatlas.org before we use it. | Nominal 2019 (2020 release) | ~1 km grid (0.00833°) | Minutes to the nearest hospital or clinic. Checked: Phnom Penh 0 min (motor) / 0 min (walk); a rural Ratanakiri point (13.9, 107.3) 24 min (motor) / 226 min (walk). | 4.2 MB per layer (Cambodia clip) | Uses MAP's own 2019 global facility list, not our MoH+OSM list. The clip includes neighbouring countries, so it must be masked to Cambodia. |
| 7 | Gridded population (WorldPop) | ✅ | HDX `worldpop-population-counts-2015-2030-khm`: `khm_pop_2025_CN_1km_R2025A_UA_v1.tif` (also 100 m) | CC BY 4.0 | 2025 (R2025A, constrained) | ~1 km grid (100 m also available) | Sum over Cambodia = **17,744,518**, which is **+2.4%** on COD-PS 2024 | 0.7 MB (1 km) / 19.6 MB (100 m) | None found. |
| 8 | National NCD indicators (WHO) | ✅ | HDX `who-data-for-khm`: `noncommunicable_diseases_indicators_khm.csv`; plus the WHO GHO API for hypertension (not in the HDX files) | WHO GHO data: CC BY-NC-SA 3.0 IGO ⚠️ (non-commercial) | 2019–2025 (see the national table below) | National | Obesity, overweight, diabetes, physical inactivity, tobacco, hypertension, NCD mortality | 1.7 MB | Tobacco series include **projections to 2030**; I use the latest non-projected year. **Raised blood pressure is not in any HDX WHO file** and only comes from the GHO API. |
| 9 | Populated places (OSM) | ⚠️ | HDX `hotosm_khm_populated_places` (GeoJSON) | ODbL | Snapshot 3 Nov 2026 | Points | **4,693 places**: 1,141 villages, 586 hamlets, 213 towns, 28 cities, 2,717 untagged. 2,108 named; **0 with a Khmer name** (`name:km`). | 1.1 MB zipped | Cambodia has far more villages than this, so a "find my village" search would miss most of them and would only work with Latin names. |
| 10a | Meta high-resolution population | ✅ | HDX `cambodia-high-resolution-population-density-maps-demographic-estimates`: general, women, men, 60+, under-5 and youth GeoTIFFs | CC BY 4.0 | 2020 | ~30 m grid | Population by group | ~24 MB per layer | Older (2020) than WorldPop 2025. It would only add age groups, such as 60+. |
| 10b | Meta Relative Wealth Index | ⚠️ | HDX `relative-wealth-index`: `khm_relative_wealth_index.csv` | **CC BY-NC 4.0 (non-commercial)** | Published 2021 | 2.4 km grid points | 14,399 points with `rwi` and `error` | 505 KB | **Non-commercial licence**, which may conflict with a venture product. DHS wealth quintiles (#5) are an alternative. |
| 11 | WFP food prices | ✅ | HDX `wfp-food-prices-for-cambodia`: `wfp_food_prices_khm.csv` | CC BY-IGO | 2003 to **Sep 2026** | Market points (56 markets), with province names | Since 2023, 28,163 vegetable and fruit price rows: water spinach, yardlong beans, cabbage, eggplant, bananas and others, in KHR/kg | 12.8 MB | **24 of 25 provinces (no Kep).** Province names differ slightly from COD-AB (e.g. "Siemreap", "Oddar Meanchey"). |
| 12 | World Bank health indicators | ✅ | HDX `world-bank-health-indicators-for-cambodia`: `health_khm.csv` | CC BY 4.0 | To 2025 | National | Health spending per capita, out-of-pocket per capita, government and external spending, NCD mortality ages 30–70 | 0.95 MB | None. |
| 13 | Open Development Cambodia | ⚠️ little to add | `data.opendevelopmentcambodia.net` (CKAN API) | Mixed | Mixed | — | 874 "health" results. The relevant ones: "Access to health facilities" (CC BY 4.0) is **only a map image**, with no numbers. "Commune Database 2011" is too old. The "Health facility of Cambodia 2010" is the same MoH data as #1. Searches for "hypertension" and "diabetes" found no data. | — | Nothing new and usable for NCD analysis. |
| + | **HeiGIT accessibility (extra find)** | ✅ optional | HDX `cambodia-accessibility-indicators`: `KHM_primary_healthcare_access_wide.csv`, `KHM_hospitals_access_wide.csv` | CC BY-SA | Feb 2026 | Province (25) + district (194 primary care / 196 hospitals of 197) | Share of the population within 10, 20 … 120 minutes **by car** of primary health care or hospitals (openrouteservice + OSM + WorldPop), also by age group | ~0.5 MB each | Car only, no walking. Uses geoBoundaries IDs, not COD P-codes, so names have to be matched. 1–3 districts missing. A useful **cross-check** for #6. |

## 2. DHS 2021–22: every NCD-related indicator found (province level)

Source: KH2021DHS (field work 2021–22), via HDX topic CSVs and the DHS Program API. All indicators have **25 provinces** (plus the 14 survey regions and the national total). Ranges are the lowest and highest province values.

| Indicator ID | Indicator | Population | Provinces | Range across provinces | Use for us |
|---|---|---|---|---|---|
| AN_NUTS_W_OWT | Women overweight or obese (BMI ≥ 25) | Women 15–49 (non-pregnant) | 25 | e.g. Ratanak Kiri 9.2 · Kampong Chhnang 14.7 · Phnom Penh 30.5 · Kampong Cham 34.2 | **Risk** (FINDRISC-related) |
| AN_NUTS_W_OVW / AN_NUTS_W_OBS | Women overweight (25–29.9) / obese (≥ 30) | Women 15–49 | 25 | — | Detail |
| AN_NUTS_W_BMI | Mean BMI, women | Women 15–49 | 25 | — | Detail |
| AH_TOBC_M_ANY | Men who smoke any tobacco | Men 15–49 | 25 | 9.8 – 40.7 % | **Risk** (WHO CVD-related) |
| AH_TOBC_W_ANY | Women who smoke any tobacco | Women 15–49 | 25 | 0.1 – 21.4 % | **Risk** |
| AH_TOBC_M_DLY, AH_TOBU_*_ATB, AH_TOBU_*_BTQ | Daily smoking (men); any tobacco incl. smokeless; betel quid with tobacco | 15–49 | listed in the API; province coverage not checked yet | — | Optional detail |
| AH_HINS_W_NON / AH_HINS_M_NON | No health insurance | Women / men 15–49 | 25 | women 52.8 – 97.9 % | **Access / poverty** |
| RH_PAHC_W_DIS | Problems accessing health care: **distance to facility** | Women 15–49 | 25 (API only, not in HDX files) | 2.3 – 48.4 % (e.g. Phnom Penh 4.4, Mondul Kiri 31.2, Ratanak Kiri 41.2) | **Access** (self-reported) |
| RH_PAHC_W_MON | Problems accessing health care: getting money for treatment | Women 15–49 | listed in the API; province coverage not checked yet | — | Poverty / access |
| HC_WIXQ_P_LOW | Population in the lowest wealth quintile | Household population | 25 | 0 – 75.4 % | **Poverty** (alternative to Meta RWI, no NC licence issue) |
| — | **Blood pressure / hypertension (adults)** | — | **❌ not available** | — | The only BP items are antenatal and postnatal "BP measured" (pregnancy care), which aren't relevant |
| — | **Blood glucose / diabetes** | — | **❌ not available** | — | — |
| — | Men's BMI / overweight | — | **❌ not available** | — | — |
| — | Physical activity, diet, alcohol (adults) | — | **❌ not available** | — | — |

## 3. National NCD figures (WHO, latest non-projected year, both sexes)

| Indicator | Value | Year | Source |
|---|---|---|---|
| Hypertension, adults 30–79 (age-standardised) | 25.7 % [18.3–34.3] | 2019 | WHO GHO API `NCD_HYP_PREVALENCE_A` |
| …of whom diagnosed / controlled | 50.8 % / 22.0 % | 2019 | `NCD_HYP_DIAGNOSIS_A`, `NCD_HYP_CONTROL_A` |
| Diabetes prevalence (age-standardised) | 14.1 % [10.6–18.0] | 2022 | HDX WHO NCD file, `NCD_DIABETES_PREVALENCE_AGESTD` |
| Overweight, BMI ≥ 25 (age-standardised) | 26.6 % [24.6–28.8] | 2024 | `NCD_BMI_25A` |
| Obesity, BMI ≥ 30 (age-standardised) | 4.9 % [4.1–5.9] | 2024 | `NCD_BMI_30A` |
| Insufficient physical activity, 18+ | 13.3 % [8.9–18.7] | 2022 | `NCD_PAA` |
| Tobacco smoking (age-standardised) | 14.8 % [11.7–18.0] | 2025 (modelled estimate) | `M_Est_smk_curr_std` |
| Probability of dying 30–70 from CVD, cancer, diabetes or chronic respiratory disease | 23.0 % [13.5–35.1] | 2023 | `NCDMORT3070` |

## 4. Important constraints for Phase 2

1. **Python is not installed** on this PC (`python`, `py` and the Python folders on PATH are missing or empty). Choose one:
   - **(a)** build the pipeline in **Node/TypeScript**, the same language as the existing facility pipeline. I tested reading the GeoTIFFs with the `geotiff` npm package, and it works.
   - **(b)** you install Python 3.12, and I use geopandas and rasterio as your prompt suggests.

   I recommend **(a)**: one language, and no new install for whoever rebuilds it.
2. **There is no province-level blood pressure or blood sugar data.** The "Risk" part of the gap index can only use **women's overweight/obesity** and **smoking (men and women)**, all for ages 15–49. National hypertension and diabetes figures can go in context text, not on the map.
3. **District and commune population** must come from WorldPop (COD-PS stops at province). WorldPop is +2.4% on the official national total.
4. **Non-commercial licences:** Meta RWI (CC BY-NC 4.0) and the WHO GHO data (CC BY-NC-SA 3.0 IGO, the same licence as the WHO chart we already use). If SokhaPheap is ever sold commercially, both need review. **DHS wealth quintiles avoid the RWI issue.**
5. **The MAP licence** isn't stated by the map server; I'll confirm it on malariaatlas.org before we use it.
6. **Downloads from Amazon S3 (HDX and OSM files) are flaky from this network.** I used retries over IPv4, and everything above eventually downloaded. Nothing needs a manual download so far.

## 5. Decisions for you

1. **Datasets:** which to use? My recommendation:
   - **Use:** #1, #2, #3, #4, #5, #6, #7, #8, #12, plus HeiGIT as a cross-check
   - **Optional:** #11, WFP prices for the diet tip (no Kep)
   - **Skip:** #9 (too few villages, no Khmer names), #10a (older than WorldPop), #10b (non-commercial; use DHS wealth instead), #13
2. **DHS indicators for the gap index "Risk":** women overweight/obese, men smoking and women smoking? Also use **RH_PAHC_W_DIS** (distance is a problem) in "Access", and **HC_WIXQ_P_LOW** (lowest wealth quintile) as "Poverty"?
3. **Pipeline language:** Node/TypeScript (recommended) or install Python?
4. **Travel time source:** MAP (car and walking, 2019, per 1 km cell) as the main source, with HeiGIT (car, 2026) as a cross-check? Or the other way round?
