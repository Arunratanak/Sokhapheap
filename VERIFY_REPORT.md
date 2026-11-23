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
