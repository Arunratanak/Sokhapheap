# Method card: WHO laboratory-based CVD risk (module `who_cvd_lab`)

| | |
|---|---|
| **Status** | `draft` (built 24 Nov 2026; needs a clinician to check the 10 sample cells below and the decisions marked `TODO(VERIFY)`) |
| **Health area** | Heart and blood vessels |
| **Sensitivity** | normal |
| **Source** | R-WHO-HEARTS-2020, Annex 2, **PDF page 44 (printed page 42)**: "WHO cardiovascular disease risk laboratory-based charts — South-East Asia". The page lists Cambodia. Annex 1 (PDF page 25) gives printed page 42 for this chart. Instructions: Table 2 (PDF page 19). Management: Table 3 (PDF page 21). |
| **Archived** | `docs/references/sources/WHO_HEARTS_risk-based-CVD-management_2020.pdf`, sha256 `1f836448bc5f0455b717d9c1d6fc4cb057a286b8303fa940bf14c356785e2510` (the extraction script refuses to run if the hash changes) |
| **Licence** | CC BY-NC-SA 3.0 IGO (non-commercial; needs review if SokhaPheap becomes commercial) |
| **Validation in Asian populations** | Same as the non-lab chart: the WHO 2019 charts were recalibrated for 21 global regions, and this is the South-East Asia chart. It has not been validated in a Cambodian cohort. The source (PDF page 13) says the lab-based charts "should be used for treatment decisions", while the non-lab charts are for screening and referral. |
| **Khmer version** | No official Khmer version exists. The question, band and next-step wording is SokhaPheap's (`UNVALIDATED_TRANSLATION`, Khmer review pending). |

## Inputs (Table 2, PDF page 19)
- **Diabetes** (people with / without diabetes). Source footnote †: "Fasting plasma glucose ≥7.0 mmol/L (126 mg/dL), or 2-h plasma glucose ≥11.1 mmol/L (200 mg/dL), or HbA1c ≥6.5% or known diabetes". The app uses:
  - profile "Diabetes" ticked → diabetes;
  - otherwise the question "Has a blood test ever shown high blood sugar?" (help text gives the fasting glucose and HbA1c cut-offs above) → *Yes* = diabetes, *No* = no diabetes, *Never tested / don't know* = **not scored** (the source: "These charts are to be used only for individuals whose status regarding diabetes and total cholesterol is available", PDF page 18).
  - `TODO(VERIFY)`: the question doesn't ask about the 2-hour glucose test, which is rare in primary care. The clinician should confirm this is acceptable.
- **Sex** (men / women)
- **Smoking:** footnote \* "Current smoker". Former smokers count as non-smokers, the same as in the non-lab module.
- **Age group:** 40–44 … 70–74
- **Systolic blood pressure (mmHg):** <120, 120–139, 140–159, 160–179, ≥180
- **Total cholesterol (mmol/l):** <4, 4–4.9, 5–5.9, 6–6.9, ≥7. Footnote ‡: "Cholesterol values are to be entered in the chart as mmol/L (To convert mg/dL to mmol/L, multiply by 0.02586. e.g 200 mg/dL x 0.02586 = 5.172 mmol/L.)" The app accepts either unit and converts with this factor.

The user types the cholesterol value from their lab report. It isn't yet taken from the lab-report explainer.

## Scoring
A lookup in the 1400-cell table (2 diabetes × 2 sexes × 2 smoking × 7 ages × 5 SBP × 5 cholesterol). The values were read from the PDF text layer by position, using `scripts/data/extract_who_cvd_lab_chart.ts` (`npm run data:who-lab-chart`), and written to `src/domain/scoring/whoCvdLabTable.ts`. The script fails unless it finds exactly 1400 cells and uses every number in the chart area exactly once. The tests check that risk never falls with older age, higher SBP, higher cholesterol, smoking or diabetes, across all 1400 cells.

Bands follow the chart legend: <5%, 5–<10%, 10–<20%, 20–<30%, ≥30%. The band words are the same as the non-lab module's.

**Decisions to confirm (`TODO(VERIFY)`):**
- **Cholesterol between printed limits:** the columns are treated as `<4 | 4–<5 | 5–<6 | 6–<7 | ≥7`. For example, 4.95 falls in "4–4.9", and 193 mg/dL (4.99 mmol/L) falls in "4–4.9". This is the same rule as the non-lab BMI columns.
- **Implausible numbers:** values outside 1–20 mmol/L after conversion aren't scored. The user is asked to check the unit instead, which catches "200" entered as mmol/L. This range is SokhaPheap's, not from the source.

## Eligibility
Ages 40–74 (the chart's age axis).

`TODO(VERIFY)`: Table 3 says people with established CVD (or diabetes with CVD, or renal disease) "should continue the treatment already prescribed and be considered as having risk >20%". This isn't implemented yet. The clinician should decide whether people who tick "Heart disease or stroke" should skip the chart.

## Red flags
None in the module itself. Urgent symptoms are screened before the profile.

## Next steps (Table 3 "Management guidance for total CVD risk", PDF page 21)
| Result | Source text (abridged) | App next step |
|---|---|---|
| <5% | "If risk <5%, follow up in 12 months." | Keep up healthy habits and check again in about a year. |
| 5–<10% | "follow up every 3 months until targets are met, then 6–9 months thereafter" | Visit a health centre for advice on food, exercise, smoking and alcohol. WHO advises a check-up every 3 months until targets are met, then every 6–9 months. |
| 10–<20% | "Persistent BP ≥140/90 mmHg consider drugs … Follow up every 3–6 months." | Visit a health centre for advice and a blood pressure check. WHO advises a check-up every 3–6 months. |
| ≥20% | "Give a statin. Follow up every 3 months." | Visit a doctor or health centre in the next few weeks. |
| TC ≥ 8 mmol/L (any risk) | "Consider drug treatment for … all individuals with total cholesterol at or above 8 mmol/L (320 mg/dL)." | Your total cholesterol is 8 mmol/L (320 mg/dL) or more … visit a doctor. Urgency is raised to **high** (`TODO(VERIFY)`: SokhaPheap's rule). |
| BP unknown | — | Get your blood pressure measured, then check again. |
| Cholesterol unknown | PDF page 18: use the non-lab chart instead | Ask a health centre for a cholesterol test (the card points to the non-lab check). |
| Diabetes status unknown | PDF page 18 (same) | Ask a health centre for a blood sugar test. |

`monitorIntervalMonths` is `null` because Table 3 gives a different interval for each band, not one interval for the module.

## Sample cells for the clinician (read by eye from the rendered page, and tested in `src/domain/scoring/whoCvdLab.test.ts`)
| Diabetes | Sex | Smoking | Age | SBP | Total chol. | App value |
|---|---|---|---|---|---|---|
| No | Men | Non-smoker | 70–74 | ≥180 | ≥7 | **35%** |
| Yes | Men | Smoker | 70–74 | ≥180 | ≥7 | **59%** |
| No | Women | Non-smoker | 40–44 | <120 | <4 | **1%** |
| Yes | Women | Smoker | 55–59 | 140–159 | 5–5.9 | **20%** |
| No | Men | Smoker | 60–64 | 120–139 | 4–4.9 | **11%** |
| Yes | Women | Non-smoker | 65–69 | 160–179 | 6–6.9 | **22%** |
| No | Women | Smoker | 50–54 | ≥180 | <4 | **12%** |
| Yes | Men | Non-smoker | 45–49 | <120 | ≥7 | **6%** |
| No | Women | Smoker | 65–69 | 160–179 | 6–6.9 | **21%** |
| Yes | Men | Non-smoker | 50–54 | 140–159 | 5–5.9 | **10%** |

When these are confirmed, change `VERIFIED_BY: TODO(VERIFY)` in `scripts/data/extract_who_cvd_lab_chart.ts` and run `npm run data:who-lab-chart`.

## Tests
- `src/domain/scoring/whoCvdLab.test.ts`: the 8 worked examples, the 1400-cell count, the monotonic check, cholesterol column boundaries, the mg/dL conversion (source example 200 mg/dL = 5.172 mmol/L) and missing inputs.
- `src/domain/modules/who-cvd-lab/definition.test.ts`: eligibility, diabetes definition, next steps by band, the TC ≥ 8 rule, unit plausibility, km/en keys, and that the non-lab module is unchanged.
- `tests/e2e/check-cvd-lab.e2e.ts`: the full `/check` flow in a browser at 375 px, in English and Khmer.

## Review
No review record yet (`docs/references/reviews/`).
