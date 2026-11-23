# SokhaPheap: Verification Report

These are the results of running `SokhaPheap_Verification_Checklist.md`, started on 23 Nov 2026 against commit `bd01aae`. Secret values are never printed; matches were shortened or masked.

- **LOCAL:** `C:\Users\ASUS PC\Desktop\Hackathon Open Data`
- **PROD:** https://sokhapheap-6c0l.onrender.com

## Section A: Repo hygiene and secrets

| ID | Status | Evidence | Notes |
|---|---|---|---|
| A1 | PASS | `git check-ignore .env.local` → ignored. `git log --all --full-history -- .env.local` → 0 commits. I ran the same checks on `.env`, the file that actually holds your keys: ignored, 0 commits. | Your secrets are in `.env`, not `.env.local`. Both are ignored. |
| A2 | PASS | `git grep` over the tree and `git log --all -p -G` over history for `sb_secret_`, `sk-ant-`, `AIza`, `AQ.`, `postgresql://`, the Telegram token pattern, `eyJhbGciOi` (JWT) and hex strings of 40+ characters. Only 3 hits: (1) `.env.example:5`, which is the example `postgresql://postgres.<ref>:<password>@…` placeholder; (2) the same placeholder in an old version of `REVIEW.md`; (3) `scripts/check_bundle_secrets.ts:22`, which is the list of prefixes the scanner searches for (`"AIza"`, `"sb_secret_"`). No real values. | `package-lock.json` was excluded, because its integrity hashes match the hex pattern. |
| A3 | PASS | The 12 variables read via `process.env` in `src/`, `scripts/` and `next.config.ts` exactly match the keys in `.env.example`. Nothing is missing and nothing is unused. | Three keys have **non-secret defaults** rather than empty values: `AI_MODEL=gemini-3.8-flash`, `AI_MODEL_FAST=gemini-3.5-flash-lite` and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. All secret keys are empty. **Decision (you, 23 Nov):** keep these defaults. |
| A4 | PASS | `render.yaml`: all 11 runtime variables use `sync: false` with no value. The only literal values are `NODE_VERSION: "24"` and `NEXT_TELEMETRY_DISABLED: "1"`, which are not secrets. | `SUPABASE_DB_URL` is intentionally absent. It's used only by `scripts/db_migrate.ts` and `scripts/check_bundle_secrets.ts`, not at runtime. |
| A5 | PASS | No `"use client"` file reads any non-`NEXT_PUBLIC_` env var. The secret-using libs (`lib/ai/gemini.ts`, `lib/bot/bot.ts`, `lib/db/supabase.ts`) import `server-only`; the other secret users are API route handlers (server-only by design). `npm run check:secrets` on a **fresh** build (`.next` deleted and rebuilt) found none of the real values of the 7 server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `ORG_DASHBOARD_ACCESS_CODE`) and none of the prefixes `AIza`, `sb_secret_` or `service_role`, across 26 client files. | |
| A6 | PASS | `npm audit --omit=dev` (the current form of `--production`) → `{"info":0,"low":0,"moderate":0,"high":0,"critical":0}`. `npm ci` also reported 0 vulnerabilities, including dev dependencies. | |
| A7 | PASS | `README.md` (90 lines) lists all 4 open data sources (MoH 2010 facilities, OSM/HOT facilities, admin boundaries and the WHO HEARTS chart, p. 65), with licences, and links to `data/SOURCES.md`. Architecture, commands, deploy steps and limitations match the code. | `data/SOURCES.md` lists the 3 datasets; the WHO chart source is in code and `REVIEW.md`. It is checked again under C9/D5. |

## Section B: Build and automated tests

| ID | Status | Evidence | Notes |
|---|---|---|---|
| B1 | PASS | `npm ci` → "added 500 packages, and audited 501 packages in 1m … found 0 vulnerabilities", exit 0. | |
| B2 | PASS | Ran `npm run build` after deleting `.next`: exit 0, "✓ Compiled successfully in 16.0s", "Finished TypeScript in 6.7s", 26/26 static pages, and no errors or warnings in the log. `npx tsc --noEmit` also exited 0, so there are no type errors in the tests and scripts either. | |
| B3 | PASS | `npm run lint` (eslint) → exit 0, no warnings. | |
| B4 | PASS | `npm test` → **Test Files 9 passed (9), Tests 82 passed (82)**. | |
| B5 | PASS | `npm run test:coverage` (v8, `src/lib/scoring/**`): **statements 98.72% (155/157), branches 95.6% (174/182), functions 100%, lines 98.24%**. By file: `findrisc.ts` 98.14%; `labRanges.ts` 98.21%; `whoCvd.ts` and `whoCvdTable.ts` 100%. | The text table hides fully covered files, so the per-file figures come from the JSON summary. |

**Summary so far:** A: 7 PASS. B: 5 PASS. No fixes were needed.

## Section C: Medical scoring

Checked 23 Nov 2026. Fresh evidence: `npm test` → **93/93 tests pass** (82 before plus 11 new checklist tests). Scoring coverage is still 98.72% of statements.

### FINDRISC

| ID | Status | Evidence | Notes |
|---|---|---|---|
| C1 | PASS | Compared row by row; see the table below. Every row of the prompt's Phase 3a table matches `src/lib/scoring/findrisc.ts`: cut-offs at lines 53–59 and 86–91, points at 118 and 125–139. | Ranges are inclusive at the top ("25–30 → 1" means 30.0 → 1 and 30.1 → 3), as written in the prompt. |
| C2 | PASS | `findrisc.test.ts`, block "verification checklist C2–C7", using the checklist's **exact** values: age 44/45/54/55/64/65 → 0/2/2/3/3/4 · BMI 24.9/25/30/30.1 → 0/1/1/3 · waist (men) 93/94/102/103 → 0/3/3/4 · waist (women) 79/80/88/89 → 0/3/3/4. All pass. | **Tests added:** the existing tests used 24.99/30.25 and 93.9/102.1, so I added the checklist's exact values. |
| C3 | PASS | Scores 6, 7, 11, 12, 14, 15, 20, 21 give low, slightly elevated, slightly elevated, moderate, moderate, high, high, very high (`findriscBand`, `findrisc.ts:78-84`). Also tested end to end with full inputs (test "8. band edges"). | |
| C4 | PASS | `recommendGlucoseTest: score >= 12` (`findrisc.ts:153`). Tests: 11 → false, 12 → true, plus the C3/C4 table. | |
| C5 | PASS | Minimum: base person → 0. Maximum: two different people (a man aged 70 and a woman aged 80) → 26. | |
| C6 | PASS | `calculateBmi = weightKg / (heightCm/100)²` (`findrisc.ts:73-76`). Tests: 165 cm / 78 kg → 28.7 and 150 cm / 45 kg → 20.0. | |
| C7 | PASS | Test "C7": for 5 different people, the returned factors add up to the score. Factors with 0 points are left out, which doesn't change the sum. | **Test added.** |
| C8 | NEEDS HUMAN | `FINDRISC_CUTOFFS.asian` exists with `enabled: false` and `bmi: null, waist: null`, marked `TODO(VERIFY)` (`findrisc.ts:60-68`). Candidate sources are noted in the comments. Using it throws "not verified" (tested). | The standard cut-offs are used. A clinician has to decide whether the Asian cut-offs are ever used. |

**C1 side-by-side (prompt → code):**

| Item | Prompt, Phase 3a | Code |
|---|---|---|
| Age | <45 → 0 · 45–54 → 2 · 55–64 → 3 · >64 → 4 | `age<45→0; ≤54→2; ≤64→3; else 4` |
| BMI | <25 → 0 · 25–30 → 1 · >30 → 3 | `bmi:{low:25,high:30}`; `<25→0; ≤30→1; else 3` |
| Waist, men | <94 → 0 · 94–102 → 3 · >102 → 4 | `male:{low:94,high:102}`; `<94→0; ≤102→3; else 4` |
| Waist, women | <80 → 0 · 80–88 → 3 · >88 → 4 | `female:{low:80,high:88}`; same rule |
| Activity ≥30 min daily | yes → 0 · no → 2 | `physicallyActive ? 0 : 2` |
| Veg/fruit daily | yes → 0 · no → 1 | `dailyVegFruit ? 0 : 1` |
| BP medication ever | no → 0 · yes → 2 | `bpMedication ? 2 : 0` |
| High glucose ever | no → 0 · yes → 5 | `highGlucoseHistory ? 5 : 0` |
| Family history | none 0 · grandparent/aunt/uncle/cousin 3 · parent/sibling/child 5 | `first_degree 5 · second_degree 3 · none 0` |
| Bands | <7 · 7–11 · 12–14 · 15–20 · >20 | `<7 low; ≤11; ≤14; ≤20; else very_high` |
| Glucose test | score ≥ 12 | `score >= 12` |

### WHO CVD (non-lab)

| ID | Status | Evidence | Notes |
|---|---|---|---|
| C9 | PASS (after fix) | Code: the header of `whoCvdTable.ts` names WHO HEARTS *Risk-based CVD management* 2020, ISBN 9789240001367, Annex 3, **PDF page 65**, "South-East Asia" (with its country list, including Cambodia) and CC BY-NC-SA 3.0 IGO; `WHO_CVD_SOURCE` gives the URL. **`data/SOURCES.md` had no WHO entry.** I added a row with document, page, region (Western Pacific) and chart sub-region (South-East Asia). | **Fix:** added the WHO row to `data/SOURCES.md` (documentation only). |
| C10 | NEEDS HUMAN | All cells are filled: a script counted **700 cells, 0 empty or invalid** (integers 0–100). The table test checks 700 cells, and that risk never decreases with age, blood pressure or smoking. **`TODO(VERIFY)` is still present** in `VERIFIED_BY` (`whoCvdTable.ts:11`, `scripts/extract_who_cvd_chart.ts:82`). There's also a related `TODO(VERIFY)` on BMI boundary handling (`whoCvd.ts:47`). | A person needs to check the 10 sample cells in `REVIEW.md` §2b against page 65, then fill in `VERIFIED_BY`. |
| C11 | PASS (blood pressure unknown) / **FAIL, minor (age out of range)** | Returns `{available:false, reason}` for `age_out_of_range` (39 and 75), `bp_unknown` and `bmi_unknown` (`whoCvd.ts:68-70`, tests). **Blood pressure unknown:** the web page (LOCAL and PROD) and the bot show "Check your blood pressure first. We need it to estimate your heart risk…" (Khmer: សូមវាស់សម្ពាធឈាមរបស់អ្នកជាមុនសិន…). Proven by the "BP UNKNOWN" row in `tests/e2e/consistency.e2e.ts`. **Age out of range:** the page says "The WHO heart risk chart is for people aged 40 to 74… A doctor can still check your heart health." It does **not** say "check your blood pressure first", which the build prompt asks for ("the UI then tells the user that a blood pressure check is the first step"). | Not fixed, because this is medical wording. ❓ Should under-40s and over-74s also be told to check their blood pressure first? |
| C12 | PASS | `whoCvd.test.ts` has **7 cases** (5 required). Expected values were read cell by cell from the rendered chart page, for example a 74-year-old male smoker, SBP 200, BMI 36 → 44%; a 40-year-old male non-smoker, SBP 110, BMI 19.9 → 1%. All pass (13/13 tests in the file). | I read these reference values from the PDF myself. A person still has to confirm them (C10, M5). |

### Lab ranges

| ID | Status | Evidence | Notes |
|---|---|---|---|
| C13 | NEEDS HUMAN | Every entry in `LAB_RANGES` (8 tests) has `unit`, `conversions`, `low`, `high` and `source` fields. But several values are **null by design**: random glucose (low and high), creatinine (low and high, so it relies on the printed range), and no lower limit for fasting glucose, HbA1c, total cholesterol, LDL and triglycerides. HDL has only a lower limit (≥40). | A clinician needs to decide the null values; questions are in `REVIEW.md` §2a. |
| C14 | PASS | New test "C14 — conversion both ways": glucose 180 mg/dL ≈ 10.0 mmol/L and back; cholesterol 200 ≈ 5.17 and back; triglycerides 150 ≈ 1.69 and back. Existing tests also cover creatinine (88.42 µmol/L = 1 mg/dL) and HbA1c (48 mmol/mol ≈ 6.54 %). | **Test added.** The app only needs mmol/L → mg/dL; the reverse is checked with the inverse factor. |
| C15 | PASS | `export type LabFlag = "normal" \| "outside_range" \| "could_not_read"` (`labRanges.ts:20`). The `"high"`/`"low"` strings in the file are the separate `direction` field, not labels. Test: "evaluation returns exactly normal / outside_range / could_not_read". | |
| C16 | PASS | Test "the report's printed range wins over our table" in `labRanges.test.ts`. | |
| C17 | NEEDS HUMAN | `labRanges.ts:4`: `VERIFIED_BY: TODO(VERIFY)`, and every entry has `verified: false`. | Needs sign-off from a doctor or nurse. |

### Consistency

| ID | Status | Evidence | Notes |
|---|---|---|---|
| C18 | PASS | New script `tests/e2e/consistency.e2e.ts` runs 4 fixed people through **6 sources**: the unit functions, `/api/risk` on LOCAL and PROD, the web page on LOCAL and PROD (375 px, real browser), and the **real bot handlers** with fake Telegram updates (offline). All 24 results agree; see the table below. | Nothing was saved and no AI was called: the API used `save:false`, the browser's request was rewritten to `save:false` and `/api/explain` was blocked, and the bot ran with AI and database switched off. The database count was unchanged (10 → 10). The real Telegram bot is tested in I3. |
| C19 | PASS | `src/lib/scoring/*.ts` imports only each other (`whoCvd.ts` imports `findrisc` types and `whoCvdTable`). `src/lib/risk.ts` imports only the two scoring modules and the schema types. A grep for `genai`, `gemini`, `/ai/`, `anthropic`, `openai` in scoring and `risk.ts` found nothing. | |

**C18 results** (FINDRISC score, band · heart risk):

| Person | unit | API LOCAL | API PROD | web LOCAL | web PROD | bot |
|---|---|---|---|---|---|---|
| LOW (man 42, BMI 20.8, waist 80, active, SBP 115) | 0 low · 1% (<5) | 0 low · 1% (<5) | 0 low · 1% (<5) | 0 low · <5 | 0 low · <5 | 0 low · <5 |
| MODERATE (woman 50, BMI 25.8, waist 85, inactive, no daily veg, family 2nd-degree, SBP 135) | 12 moderate · 3% (<5) | same | same | same | same | same |
| HIGH (man 58, BMI 28.7, waist 98, BP medication, family 2nd-degree, smoker, SBP 150) | 15 high · 13% (10–20) | same | same | same | same | same |
| BP UNKNOWN (as HIGH, SBP unknown) | 15 high · bp_unknown | same | same | same | same | same |

The web page and the bot show heart risk as a band label, not a percentage, so for them the band is compared.

### ⚠️ Found during Section C: test runs had saved rows to the real database
The Supabase `screenings` table has **10 non-demo rows**:
- **9 `web` rows from 03:48–03:49 UTC** are from my test run. Their scores (2, 7, 3, 4, 5, 26, 12, 15, 9) are the `risk-ui.e2e.ts` cases. I ran that test against the local server during the map fix, and the local server uses the same Supabase project as PROD.
- **1 `bot` row from 03:42 UTC** (score 9) is most likely your phone test.

**Fix made (test code only):** `tests/e2e/risk-ui.e2e.ts` now rewrites its `/api/risk` request to `save:false`. I re-ran it: 10/10 cases still match, and the row count stayed at 10. `demo.e2e.ts` and `a11y.e2e.ts` already use `?demo=1`, which doesn't save. ❓ **Can I delete the 9 test rows?** That's a data change, so I'm waiting for your OK.

### Fixes made in Section C (not committed yet)
1. `data/SOURCES.md`: added the WHO chart row (C9).
2. `src/lib/scoring/findrisc.test.ts`: added 8 checklist tests (C2–C7).
3. `src/lib/scoring/labRanges.test.ts`: added 3 two-way conversion tests (C14).
4. `tests/e2e/consistency.e2e.ts`: new C18/I3 consistency script.
5. `tests/e2e/risk-ui.e2e.ts`: no longer saves test runs to the database.

**Section C summary:** 14 PASS (including C9 after a documentation fix) · 1 partly FAIL (C11, age-out-of-range wording) · 4 NEEDS HUMAN (C8, C10, C13, C17).

## Section N: Open data analysis

Checked 23 Nov 2026 (open-data Phase 8), against LOCAL production builds plus the PROD runs noted.

| ID | Status | Evidence | Notes |
|---|---|---|---|
| N1 | PASS | Ran `npm run data:build` twice (facilities clean → downloads check → `build.ts` → `gap_index.ts`), then `sha256sum data/clean/* data/manifest.json`: **17 files byte-identical** across both runs and identical to the committed versions (`git status` clean for `data/clean`). | Raw inputs are hashed (SHA-256) in `data/manifest.json`. |
| N2 | PASS | **Insights page:** `tests/e2e/insights.e2e.ts` checks 5 districts (index, rank, motor time, population) against `data/clean`; it passes on LOCAL and **PROD**. **"Your area" card:** `src/lib/insights/area.test.ts` covers 5 locations, and each card number equals the `areas_district.json` value. **Bot `/area`:** `tests/openData.test.ts` covers 3 locations, and each number equals `/api/area`. **Planner:** `tests/e2e/planner.e2e.ts` covers 3 provinces, and the top 5 equal `gap_index_district.json`; it passes on LOCAL and **PROD**. **National figures** come from `national_context.json`; WHO GHO values were checked in the inventory. | The UI has no hard-coded figures; everything is read from `data/clean`. |
| N3 | PASS | All 11 datasets in the manifest appear by name with their licence on `/km/about`, `/en/about`, `/km/insights` and `/en/insights` (11/11 each, checked against the HTML). The About page also credits the WHO CVD chart (CC BY-NC-SA 3.0 IGO) and the map tiles (ODbL). `/api/open-data/sources` returns all 11 with licence and URL (tested), and every API response carries a CC BY 4.0 licence and a citation. | The Malaria Atlas licence shows "CC BY 4.0 (to be confirmed)". It still needs a human check on malariaatlas.org. |
| N4 | PASS | All area sentences describe the area ("In {province}, about X% of women aged 15–49…", "People in {district} live on average…"), and the card ends with "These numbers describe everyone in the area, not you personally." A regex scan of the `area`, `insights`, `planner`, `apiDocs` and bot area strings (km and en) for individual-risk wording found 0 matches; there's also a unit test for it in `area.test.ts`. | Khmer wording still needs native review. |
| N5 | PASS | `src/lib/insights/gapIndex.test.ts` has 14 tests, all passing: normalisation, weighting, ranking, ties, drivers and spearman. `data/clean/gap_index_sensitivity.md` is present (16 variants; median top-10 overlap 8/10). | |
| N6 | PASS | DHS raw files are only `kh2021dhs_subnational.json` and `kh2021dhs_national.json`, both from the DHS Program **API** (aggregated indicators), plus the HDX topic CSVs used for the inventory. No `.DTA`, `.SAV` or SAS files and no DHS dataset ZIPs anywhere under `data/raw`. No code fetches DHS datasets. | |
| N7 | PASS | **Schema:** only `facilities` has lat/lng (facility locations). `screenings` and `reminders` have no location columns. **API:** `/api/area` uses the coordinates only for the lookup, returns no coordinates, and sends `Cache-Control: private, no-store` (tested); it doesn't log. **Code scan:** no `insert`, `upsert`, `writeFile`, `console.log` or service client in the area code (tested), and no `console.log` in `src/app/api` or `src/lib/insights`. **Bot:** the location is used for the nearest facilities and the area summary only, and nothing is saved. | Render logs record request paths. GET `/api/area?lat=…` puts rounded coordinates (5 decimals, about 1 m) in the URL, and the platform's access log may keep that path. To avoid it, the lookup could switch to POST. ❓ Should I make that change? |

**Section N summary:** 7 PASS. One question for you (N7: switch the location lookup to POST so coordinates never appear in platform access logs).

## Section D: Open data

Checked 23 Nov 2026 against commit `5b3fb79`. PROD = https://sokhapheap-6c0l.onrender.com.

| ID | Status | Evidence | Notes |
|---|---|---|---|
| D1 | PASS | `npm run data:build` (which runs `data:clean`) twice: `data/clean/facilities.geojson` is byte-identical across runs and to the committed file (sha256 `a5910c72…`; `git status` clean). | Same run as N1. |
| D2 | PASS | All 1,440 facilities are inside Cambodia's bounding box (0 outside) and have a name and province (0 missing). Test "every facility is inside Cambodia with required fields" passes (`scripts/clean_facilities.test.ts`, 7/7). | |
| D3 | PASS | **25 provinces** represented: Phnom Penh 168, Siemreap 111, Battambang 110, Kampong Cham 99, Prey Veng 99, Kandal 98, Takeo 90, Banteay Meanchey 82, Tboung Khmum 65, Kampot 63, Kampong Thom 60, Kampong Speu 54, Kratie 42, Svay Rieng 41, Preah Vihear 41, Kampong Chhnang 40, Pursat 40, Ratanak Kiri 27, Preah Sihanouk 24, Mondul Kiri 22, Oddar Meanchey 18, Koh Kong 16, Stung Treng 14, Kep 8, Pailin 8. | |
| D4 | PASS | Test "no duplicates of the same type within 200 m remain" passes. | |
| D5 | PASS (after fix) | `data/SOURCES.md` listed only the 4 original datasets. **Fix:** added a table of the 8 open-data-pipeline datasets, generated from `data/manifest.json` (name, publisher, URL, licence, data year, download date, use). It now lists all 12. | Documentation only. |
| D6 | PASS | `scripts/check_db.ts`: `facilities: 1440 rows (file: 1440)`. | |
| D7 | PASS | `/km/about` and `/en/about` on LOCAL and **PROD**: 11/11 manifest datasets shown with name, licence and link, plus the WHO CVD chart and map tiles (13 external links). | |
| D8 | PASS | The README "Known issues and roadmap" section names the datasets (MoH facilities, OSM/HOT, DHS / WHO STEPS, Malaria Atlas, HeiGIT, WorldPop, COD-PS, WFP). The About page has a 4-item roadmap naming them in km and en. The pitch notes in `data/OPEN_DATA_STORY.md` name all 12. | |

## Section E: Database and security (live Supabase)

| ID | Status | Evidence | Notes |
|---|---|---|---|
| E1 | PASS | Live `information_schema` tables: `facilities`, `organizations`, `screenings`, `reminders` (plus `_migrations`). The columns match `0001_init.sql` exactly. `_migrations`: 0001, 0002, 0003 applied; these are the 3 files in `/supabase/migrations`. | |
| E2 | PASS | `pg_class.relrowsecurity = true` on all 5 public tables. Only policy: `facilities are public` (SELECT, anon and authenticated). | |
| E3 | PASS | `scripts/check_db.ts` with the anon key: reading screenings, reminders and organizations is denied (42501); inserting into screenings and facilities is denied (42501); reading facilities works (1440 rows); `nearest_facilities` RPC returns 5. | |
| E4 | PASS | Columns: id, created_at, channel, findrisc_score, findrisc_band, cvd_band, province, org_code, is_demo. No name, phone or ID. 5 random rows checked: only scores, bands, province and org code. | Counts: 98 screenings (87 demo, 11 real), 1 reminder. |
| E5 | PASS | The only `reminders` insert is in `src/lib/bot/bot.ts`, in the `remind:6` / `remind:12` button handler, so it runs only after the user taps it (opt-in). "No thanks" stores nothing, and `/stopremind` deletes unsent reminders. | `reminders.telegram_chat_id` is needed to send the message; it's pseudonymous, not a name or phone. |
| E6 | PASS | The service key and `getServiceClient` are used only in server files: `lib/db/supabase.ts` (imports `server-only`), `lib/screenings.ts`, `lib/bot/bot.ts`, and the API routes health, org and cron. None of the `"use client"` files import it. The client bundle scan (A5) found no secret values. | |

## Section F: API routes (LOCAL and PROD)

Script: `tests/e2e/api-routes.e2e.ts`, run three ways:
- **LOCAL** production build with an **invalid Gemini key**, to test the template fallback
- **PROD** with `AI=1`
- **PROD** with `SAME_IP=1`, which waits for the 1-minute rate-limit window between sections (on PROD, Cloudflare sets the client IP, so it can't be faked)

| ID | Status | Evidence (LOCAL / PROD) | Notes |
|---|---|---|---|
| F1 | PASS | `GET /api/health` → 200 `{"ok":true,…,"facilities":1440,"ai":true,"db":true,"bot":true}` on both. | |
| F2 | PASS | Valid → 200, score 15. Missing fields → 400 ("sex: Invalid option…"); age 200 → 400 ("Too big: expected number to be <=120"); negative weight → 400 (">=25"); text for a number → 400 ("expected number, received string"); not JSON → 400 ("Request body must be JSON"). Same on both. | |
| F3 | PASS | Phnom Penh → 5 results, all in Phnom Penh. Siem Reap → 5, first in Siemreap (142 m). A point in the sea → 5 results, nearest 76 km away in Preah Sihanouk (sensible). Invalid lat → 400. Same on both. | The Phnom Penh nearest is the mislabelled OSM "Praram 9 Hospital Cambodia Office" (known, REVIEW.md). |
| F4 | PASS | Kampot → 200, 63 facilities; "Atlantis" → 400 "Unknown province: Atlantis". | |
| F5 | PASS (template) / **SKIPPED (AI unavailable on PROD)** | Missing `risk` → 400 on both. **LOCAL with an invalid key:** 200, `source: "template"`, Khmer text, so the fallback works. **PROD:** 200 with Khmer text, but `source: "template"`; Gemini did not answer, probably quota (see H). | Per rule 6, not retried. AI-written Khmer on PROD is still unverified today. |
| F6 | PASS (validation) / **SKIPPED (AI unavailable on PROD)** | Non-image → 400 "Unsupported image type: text/plain"; 9 MB image → 400 "Image is too large (max 8 MB)"; empty request → 400 "Missing `image` file", on both. Valid fixture image on PROD → **503 `ai_unavailable`, `imageDeleted: true`** (handled cleanly, no crash). | Extraction worked 10/10 earlier (AI eval). It needs a re-check when the Gemini quota resets. |
| F7 | PASS | One request with 4 values gives `normal`, `outside_range`, `could_not_read` (unknown test) and `could_not_read` (wrong unit g/L). Invalid body → 400. Same on both. | |
| F8 | PASS | `POST /api/telegram` without the secret header → 401; with a wrong secret → 401. | |
| F9 | PASS | `POST /api/cron/reminders` without CRON_SECRET → 401; with a wrong one → 401. | |
| F10 | PASS | Limits: `/api/explain` 15 per minute per IP, `/api/lab/extract` 6 per minute per IP (checked before validation, so testing used no AI calls). 16th explain → **429**, 7th extract → **429**, on both. Also `/api/risk` 30 per minute and `/api/open-data/*` 60 per minute. **PROD:** 8 extract requests, each with a different fake `x-forwarded-for`, were still blocked at #7, because Cloudflare's `cf-connecting-ip` is used. | **LOCAL** (no Cloudflare) trusts `x-forwarded-for`, so the limit could be bypassed there. That doesn't apply on PROD. |
| F11 | PASS | No stack traces, file paths or internal error names in 21 (LOCAL) and 22 (PROD) responses, including every 400, 401, 404, 429 and 503. | |

**Fixes made in Sections D–F (not committed yet):** `data/SOURCES.md` gained the 8 pipeline datasets (D5), and there's a new test script `tests/e2e/api-routes.e2e.ts`.

**Summary:**
- **D:** 8 PASS (D5 after a doc fix)
- **E:** 6 PASS
- **F:** 11 PASS; for F5 and F6, the real AI part is SKIPPED on PROD because Gemini didn't answer (probably quota)
