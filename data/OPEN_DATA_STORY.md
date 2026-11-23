# SokhaPheap: the open data story (one page, for the pitch)

**12 open datasets · 11 publishers · 25 provinces, 197 districts, 1,633 communes.** Every result in SokhaPheap is powered by Cambodian and international open data. Every number below comes from `data/clean` (rebuild with `npm run data:build`), with its source and year.

## What we found

1. **About 7 in 10 Cambodians, 12.7 million people, live more than an hour's walk from the nearest health facility.** By car or motorbike, 6.5 million (37%) are more than 30 minutes away.
   *Malaria Atlas Project travel time 2019 × WorldPop 2025.*
2. **In Phnom Penh the average trip to care by motor is 2 minutes, but in Stung Treng it is 74 minutes**, and 95.5% of Stung Treng's people are more than an hour's walk away (Phnom Penh: 6.7%). The slowest district is **Kiri Sakor (Koh Kong): 148 minutes** by motor on average.
   *MAP 2019 × WorldPop 2025, district level.*
3. **585 of 1,633 communes, home to 4.4 million people, have no health facility in the open data.** In 221 communes (1.6 million people), the nearest health centre is more than 10 km in a straight line from the commune centre.
   *Ministry of Health 2010 + OpenStreetMap 2026, COD-AB communes, WorldPop 2025.*
4. **Where screening could help most: Thala Barivat (Stung Treng) ranks 1st of 197 districts on our Screening Gap Index (74/100).** There:
   - 68% of people are in the poorest fifth of households
   - 41% of men smoke
   - 32% of women say distance stops them getting care
   - there are only 0.54 facilities per 10,000 people

   *DHS 2021–22 (province) + MAP + MoH/OSM + WorldPop.*
5. **Most people have no health insurance:** 78% of women aged 15–49 nationally, and 98% in Ratanak Kiri. Meanwhile 14% of adults have diabetes (2022) and 26% of adults aged 30–79 have high blood pressure, of whom only 22% have it under control (2019).
   *DHS 2021–22; WHO GHO.*

## How each dataset flows into the app

| Dataset (publisher, year) | Map / Insights | Gap index | "Your area" card + bot `/area` | Org planner | Public API |
|---|:-:|:-:|:-:|:-:|:-:|
| Admin boundaries COD-AB (OCHA/MLMUPC, 2024) | ✅ | ✅ | ✅ location → commune/district | ✅ | ✅ |
| Population COD-PS (UNFPA/NIS, 2024) | ✅ | ✅ adults 20+ | | ✅ | ✅ |
| WorldPop 100 m (2025) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Travel time (Malaria Atlas Project, 2019) | ✅ | ✅ access | ✅ | ✅ | ✅ |
| Health facilities (Ministry of Health, 2010) | ✅ facility map | ✅ capacity | ✅ nearest centre | ✅ host sites | ✅ |
| Health facilities (OpenStreetMap/HOT, 2026) | ✅ facility map | ✅ capacity | ✅ nearest centre | ✅ host sites | ✅ |
| DHS 2021–22 subnational (aggregated) | ✅ 5 layers | ✅ risk, poverty, access | ✅ | ✅ comparison | ✅ |
| WHO NCD indicators (GHO) | ✅ national strip | | ✅ national comparison | ✅ | |
| WHO CVD risk chart (HEARTS, 2020) | | | heart risk score | | |
| World Bank health indicators | ✅ national strip | | | | |
| HeiGIT accessibility (2026) | | cross-check | | | |
| WFP food prices (2025–26) | | | ✅ vegetable price tip | | |

## What we give back

- **Processed data, CC BY 4.0:**
  - district table: `/api/open-data/download/areas_district.csv`
  - gap index map: `/api/open-data/download/gap_index.geojson`
  - public API: `/api/open-data/areas`, `/api/open-data/areas/{pcode}`, `/api/open-data/sources`
- **A reproducible pipeline:** `npm run data:build`. Two runs give byte-identical outputs, and every input has a SHA-256 hash in `data/manifest.json`.

## Honest limits

- Survey figures exist only per province and cover ages 15–49.
- There is no province-level blood pressure or blood sugar data.
- Travel times are modelled for 2019.
- Part of the facility list is from 2010.
- WorldPop and the official projection disagree for Preah Sihanouk (−26%).
- The gap index is a planning tool, not a diagnosis.
