# Method card: WHO non-laboratory CVD risk (module `who_cvd`)

| | |
|---|---|
| **Status** | `draft` (needs clinician check of the 10 sample cells in `docs/REVIEW.md` §2b) |
| **Health area** | Heart and blood vessels |
| **Sensitivity** | normal |
| **Source** | R-WHO-HEARTS-2020, Annex 3, **PDF page 65**: "WHO cardiovascular disease risk non-laboratory-based charts — South-East Asia". The page lists Cambodia in this chart group. |
| **Archived** | `docs/references/sources/WHO_HEARTS_risk-based-CVD-management_2020.pdf`, sha256 `1f836448bc5f0455b717d9c1d6fc4cb057a286b8303fa940bf14c356785e2510` |
| **Licence** | CC BY-NC-SA 3.0 IGO (non-commercial; needs review if SokhaPheap becomes commercial) |
| **Validation in Asian populations** | The WHO 2019 charts were recalibrated for 21 global regions; this is the South-East Asia region chart. Not validated in a Cambodian cohort. |
| **Khmer version** | No official Khmer version exists. The app shows only numbers and band words; the band words are SokhaPheap's translation (`UNVALIDATED_TRANSLATION`, Khmer review pending). |

## Inputs (from the chart axes on page 65)
- **Sex** (men / women)
- **Smoking:** "Smoker" / "Non-smoker". The app treats only *current* smokers as smokers. This is the chart's labelling; former smokers count as non-smokers. `TODO(VERIFY)`: clinician to confirm.
- **Age group:** 40–44, 45–49, 50–54, 55–59, 60–64, 65–69, 70–74
- **Systolic blood pressure (mmHg):** <120, 120–139, 140–159, 160–179, ≥180
- **BMI (kg/m²):** <20, 20–24, 25–29, 30–35, ≥35

## Scoring
A lookup in the 700-cell table (2 sexes × 2 smoking × 7 ages × 5 SBP × 5 BMI). The values were extracted from the PDF text layer by `scripts/data/extract_who_cvd_chart.ts` into `src/domain/scoring/whoCvdTable.ts`.

Bands follow the chart legend: <5%, 5–<10%, 10–<20%, 20–<30%, ≥30%.

Non-integer BMI is placed in half-open intervals (e.g. 24.6 → "20–24"). `TODO(VERIFY)`: clinician to confirm.

## Eligibility
Ages 40–74 (the chart's age axis). Outside this range the module is not offered.

`TODO(VERIFY)`: WHO intends the charts for people *without* established CVD. Should people who report heart disease or stroke in the profile be excluded? This is not implemented yet; clinician to decide.

## Red flags
None in the module itself. Chest pain, fainting and the other urgent symptoms are screened before the profile.

## Next steps (SokhaPheap rules, clinician to confirm, see `docs/REVIEW.md` §2c)
- ≥ 20%: "Visit a doctor or health centre in the next few weeks."
- Blood pressure unknown: "Get your blood pressure measured, then check again."
- Otherwise: "Keep up healthy habits and check again in about a year."

`monitorIntervalMonths`: `null` until the HEARTS follow-up intervals are read from the archived PDF.

## Worked examples (read from the rendered chart page; tests in `src/domain/scoring/whoCvd.test.ts`)
| Person | Chart cell | Result |
|---|---|---|
| Man, non-smoker, 72, SBP 185, BMI 19 | men · non-smoker · 70–74 · ≥180 · <20 | 26% |
| Man, smoker, 74, SBP 200, BMI 36 | men · smoker · 70–74 · ≥180 · ≥35 | 44% |
| Woman, non-smoker, 66, SBP 130, BMI 18.5 | women · non-smoker · 65–69 · 120–139 · <20 | 9% |

## Review
No review record yet (`docs/references/reviews/`).
