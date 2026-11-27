# Method card: FINDRISC (module `findrisc`)

| | |
|---|---|
| **Status** | `draft` |
| **Health area** | Metabolic |
| **Sensitivity** | normal |
| **Source** | R-FINDRISC-2003: Lindström J, Tuomilehto J. *Diabetes Care* 2003;26(3):725–731 |
| **Archived** | ❌ **Not yet.** diabetesjournals.org returned HTTP 403 to automated download (23 Nov 2026). **Action for the user:** download the PDF, or the official FINDRISC form from the Finnish Diabetes Association, and put it in `docs/references/sources/`. |
| **Licence** | The FINDRISC form is widely reproduced for screening. `TODO(VERIFY)`: confirm the terms of use with the Finnish Diabetes Association. |
| **Validation in Asian populations** | `TODO(VERIFY)`: to be researched in Phase 2 (literature on FINDRISC in Asian / South-East Asian populations). |
| **Khmer version** | **None found yet.** The Khmer question wording in the app is SokhaPheap's own: `UNVALIDATED_TRANSLATION`. Per rule 4 it needs a validated version or the user's approval. |

## Items and points
**Interim source:** the items below come from the build prompt the user provided (`SokhaPheap_ClaudeCode_Build_Prompt.md`, Phase 3a), quoted exactly. They must be checked against the original paper once it's archived.

| Question | Answer → points |
|---|---|
| Age | <45 → 0 · 45–54 → 2 · 55–64 → 3 · >64 → 4 |
| BMI (kg/m²) | <25 → 0 · 25–30 → 1 · >30 → 3 |
| Waist (cm), men | <94 → 0 · 94–102 → 3 · >102 → 4 |
| Waist (cm), women | <80 → 0 · 80–88 → 3 · >88 → 4 |
| ≥30 min physical activity daily | yes → 0 · no → 2 |
| Vegetables/fruit/berries every day | yes → 0 · no → 1 |
| Ever taken blood pressure medication | no → 0 · yes → 2 |
| Ever had high blood glucose | no → 0 · yes → 5 |
| Family history of diabetes | none → 0 · grandparent/aunt/uncle/first cousin → 3 · parent/sibling/own child → 5 |

**Bands:** <7 low · 7–11 slightly elevated · 12–14 moderate · 15–20 high · >20 very high. Recommend a blood sugar test at ≥12.

## In the module system
- **From the shared profile:** age, sex, height, weight (BMI is calculated), waist (or unknown), BP medication, family history of diabetes.
- **Extra module questions:** physical activity, vegetables/fruit, ever high blood glucose.
- **Unknown waist:** the score is shown as a range (the lower bound, up to +4).

## Eligibility
Adults 18+. `TODO(VERIFY)`: FINDRISC screens people *without* known diabetes. Should people who report known diabetes be excluded? This is not implemented yet; clinician to decide.

## Red flags
None in the module. Urgent symptoms are screened first.

## Next steps (same rule as the /risk flow)
- High or very high: see a doctor soon.
- ≥ 12: blood sugar test.
- Otherwise: healthy habits, check again in about a year.

`monitorIntervalMonths`: `null` (no archived source yet).

## Tests
- Every cut-off is boundary-tested in `src/domain/scoring/findrisc.test.ts` (C2–C7).
- `src/domain/modules/findrisc/definition.test.ts` covers the module layer.
- `src/domain/modules/modules.test.ts` proves the results are identical to the /risk flow for 14 profiles.

## Review
No review record yet (`docs/references/reviews/`).
