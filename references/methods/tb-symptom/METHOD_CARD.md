# Method card: Tuberculosis symptom screen (module `tb_symptom`)

| | |
|---|---|
| **Status** | `draft` (built 24 Nov 2026; needs clinician sign-off, see `TODO(VERIFY)` below) |
| **Health area** | Lungs and breathing |
| **Sensitivity** | normal (pre-selected for every adult) |
| **Source** | R-WHO-TB-SCREEN-2021: WHO. *WHO consolidated guidelines on tuberculosis. Module 2: Screening. Systematic screening for tuberculosis disease.* Geneva: WHO; 2021. ISBN 9789240022676. https://www.who.int/publications/i/item/9789240022676 |
| **Archived** | ✅ `references/sources/WHO_TB_Module2_Screening_2021.pdf` (68 pages, sha256 `fe6b4fd444dd15ce421f3920311b1786ec48ae94df841d9c03524b2614be51f3`; downloaded manually by the project owner, 24 Nov 2026) |
| **Licence** | CC BY-NC-SA 3.0 IGO |
| **National wording** | **Not used.** The official CENAT (National Center for Tuberculosis and Leprosy Control) symptom-screen wording couldn't be obtained. The module follows the WHO guideline alone. If the CENAT form becomes available, swap its wording into `check.tb.*` in `src/lib/i18n/*.json`. |
| **Validation (Asian / Cambodian)** | The Table 3 accuracy data pool 28 studies, including prevalence surveys in Asian countries (PDF page 35). There is no Cambodia-specific validation in the archived source. |
| **Khmer version** | No validated Khmer item set. The wording is SokhaPheap's (`UNVALIDATED_TRANSLATION`, Khmer review pending). |

## What the source says (quoted)
- **Who:** Recommendation 9 (PDF page 35): "Among individuals aged 15 years and older in populations in which TB screening is recommended, systematic screening for TB disease may be conducted using a symptom screen, chest X-ray or molecular WHO-recommended rapid diagnostic tests, alone or in combination."
- **Which symptoms:** Table 3 (PDF page 36), row "Any TB symptom (cough, haemoptysis, fever, night sweats, weight loss)": sensitivity **0.71**, specificity **0.64**. The other rows were prolonged cough (≥ 2 weeks), sensitivity 0.42, and any cough, sensitivity 0.51. The guideline ranks "any TB symptom" above cough-only screens ("higher sensitivity and lower specificity", PDF page 36), so the module uses the any-symptom screen.
- **Not a diagnosis:** PDF page 35: "Screening tests need to be followed by a diagnostic test, offered as part of a comprehensive clinical evaluation, to confirm or rule out TB disease in individuals who screen positive."
- **Close contacts:** Recommendation 4 (PDF page 14): "Household contacts and other close contacts of individuals with TB disease should be systematically screened for TB disease". PDF page 34: they "should always be screened for TB".
- **Risk factors:** Table 2 (PDF pages 32–33) lists diabetes, previous TB, chronic lung disease, smoking ("people who smoke or who have a history of smoking"), alcohol use disorder, substance use disorder, malnourishment, pregnancy, immunocompromising conditions and health care workers.

## Items
Yes/no questions. "Recently" is SokhaPheap's wording: the source gives no time window for fever, night sweats, weight loss or haemoptysis (`TODO(VERIFY)`).
1. Do you have a cough now? (the source says "cough"; the people-living-with-HIV screen uses "current cough", PDF page 15)
2. Have you coughed up blood recently? (haemoptysis)
3. Have you had a fever recently?
4. Have you had night sweats recently? (help text: sweating so much at night that clothes or bed sheets get wet)
5. Have you lost weight recently without trying?
6. Has someone you live with, or spend a lot of time with, had TB? (Recommendation 4)

## Scoring
| Answers | Band | Urgency | Next step |
|---|---|---|---|
| Any of items 1–5 = yes | `positive` "You have a possible TB symptom: get a TB test" | high | Go to a health centre and ask for a TB test; this check is not a diagnosis. |
| Items 1–5 all no, item 6 yes | `contact` "Close contact of someone with TB: get checked" | moderate | Go to a health centre, say you're a close contact, and ask to be checked (WHO: contacts should always be screened). |
| All no | `negative` "No TB symptoms right now" | low | A symptom check misses about 3 in 10 people with TB (sensitivity 0.71). If symptoms start, ask for a TB test. |

The symptoms reported (and close contact) are listed on the card under "What raised your result". The Table 2 risk factors the profile already knows (diabetes, current or former smoking, pregnancy) are recorded in `details.riskFactors` but don't change the result or appear on the card.

## Decisions to confirm (`TODO(VERIFY)`)
- **Coughing up blood** is a positive screen, not a red flag, because the source doesn't call it an emergency. Should it send people to the urgent "go to hospital now" screen?
- **"Recently"** has no time window. Should there be one (e.g. 2 weeks)? Cambodian programme criteria reportedly use symptoms lasting ≥ 2 weeks (Phase 2 research, not archived).
- **Free testing:** Phase 2 research found TB diagnosis and treatment are free in Cambodia, but this isn't in an archived source, so the app doesn't say it.
- **Where to test:** the facility data has no "TB testing" field, so the card links to the nearest health centre.
- **People living with HIV and children under 15** have their own screens in the source (Recommendations 11–17). They aren't covered: the app doesn't ask about HIV, and the profile is for adults (18+).

## Tests
- `src/lib/modules/tb-symptom/definition.test.ts`:
  - each symptom alone is positive;
  - the contact-only and negative paths;
  - risk factors never change the result;
  - eligibility and pre-selection;
  - urgency sorting;
  - km/en keys.
- `tests/e2e/check-tb.e2e.ts`: the positive, contact and negative paths in a browser at 375 px, in English and Khmer.

## Review
No review record yet (`references/reviews/`).
