# Method card: Blood pressure check (module `bp_check`)

| | |
|---|---|
| **Status** | `draft` (built 24 Nov 2026; needs clinician sign-off, see `TODO(VERIFY)` below) |
| **Health area** | Heart and blood vessels |
| **Sensitivity** | normal (pre-selected for every adult) |
| **Tool** | Reads the profile's latest blood pressure reading against the WHO 2021 guideline. It's a reading, not a risk score. |
| **Source** | R-WHO-HTN-2021: WHO. *Guideline for the pharmacological treatment of hypertension in adults.* Geneva: WHO; 2021. ISBN 9789240033986. https://www.who.int/publications/i/item/9789240033986 |
| **Archived** | ✅ `docs/references/sources/WHO_hypertension_pharmacological_treatment_2021.pdf` (61 pages, sha256 `57f6376d5c9bc4ea6c44873625547c8a5443d5a6ad8c8c422733681563db05fb`; downloaded manually by the project owner, 24 Nov 2026) |
| **Licence** | CC BY-NC-SA 3.0 IGO |
| **Validation** | Official WHO global guideline. Not specific to Cambodia. |
| **Khmer version** | N/A (a reading, not a questionnaire). The explanation text is SokhaPheap's (`UNVALIDATED_TRANSLATION`, Khmer review pending). |

## What the source says (quoted)
- **Scope** (PDF page 14): "The guideline does not address measurement of blood pressure or diagnosis of hypertension. It addresses pharmacotherapy in individuals with a 'confirmed' diagnosis of hypertension, such as hypertension diagnosed when blood pressure is found to be elevated on two different days." Also: "The guideline does not address hypertensive crisis".
  - The guideline also says it "will replace the guidance in the modules Evidence-based protocols and Risk-based CVD management of the HEARTS technical package … regarding the threshold for initiation of treatment". So the HEARTS protocols module is no longer needed for this check.
- **Recommendation 1** (PDF pages 9–10 and 19):
  - Treatment of "individuals with a confirmed diagnosis of hypertension and systolic blood pressure of ≥140 mmHg or diastolic blood pressure of ≥90 mmHg" (strong).
  - "Existing cardiovascular disease and systolic blood pressure of 130–139 mmHg" (strong).
  - "High cardiovascular risk, diabetes mellitus, or chronic kidney disease, and systolic blood pressure of 130–139 mmHg" (conditional).
- **Implementation remark** (PDF page 19): "If blood pressure level is high (e.g. systolic ≥160 mmHg or diastolic ≥100 mmHg) or there is accompanying evidence of end organ damage, initiation of treatment should be started without delay."
- **Recommendation 6** (PDF pages 10–11): target "<140/90 mmHg in all patients with hypertension without comorbidities". Systolic "<130 mmHg in patients with hypertension and known cardiovascular disease" (strong), and in "high-risk patients … (those with high CVD risk, diabetes mellitus, chronic kidney disease)" (conditional).
- **Recommendation 7** (PDF page 11): "monthly follow up after initiation or a change in antihypertensive medications until patients reach target" and "follow up every 3–6 months for patients whose blood pressure is under control".
- **Lifestyle** (PDF page 14): "reducing salt intake (to less than 5g daily); eating more fruit and vegetables; being physically active on a regular basis; avoiding use of tobacco; reducing alcohol consumption …"
- **Pregnancy** (section 4.3, PDF pages 34–35): "HTN in pregnancy is generally diagnosed when BP is ≥140 mmHg and/or ≥90 mmHg on at least two occasions, at least six hours apart", and it "must be diagnosed, treated (when appropriate), and followed up diligently".

## Inputs
From the shared profile only (no extra questions):
- latest systolic and diastolic reading;
- on blood pressure medicine;
- known high blood pressure, heart disease or stroke, diabetes or kidney disease;
- pregnancy.

"On treatment" means taking blood pressure medicine *or* known high blood pressure: the diagnosis is already confirmed. If the bottom number is unknown, the top number alone is used.

## Rules (first match wins)
| Condition | Band | Urgency | Next step (abridged) |
|---|---|---|---|
| No reading | `unavailable` | not checked | Get your blood pressure measured, then check again. |
| Pregnant and ≥140 or ≥90 | `pregnancy_high` | high | Needs checking by a doctor or midwife soon. |
| ≥160 or ≥100 | `very_high` | high | WHO: treatment should start without delay. See a doctor or health centre as soon as you can. |
| ≥140 or ≥90, on treatment | `above_target` | moderate | Above the <140/90 target; talk to your health worker (monthly checks after a medicine change). |
| ≥140 or ≥90, not on treatment | `high` | moderate | One reading isn't a diagnosis; it's confirmed when high on two different days. Re-measure on another day. |
| Heart disease, diabetes or kidney disease, 130–139, on treatment | `above_target_130` | moderate | WHO's systolic target is <130; talk to your health worker. |
| Same, not on treatment | `high_risk_130` | moderate | WHO advises a health worker considers treatment at this level. |
| Otherwise, on treatment | `at_target` | low | Within target; WHO suggests a check every 3–6 months. |
| Otherwise | `below_140_90` | low | Below 140/90, the WHO treatment level; healthy-habit tips from PDF page 14. |

The app never calls one reading "hypertension" or "normal". The guideline defines neither from a single reading.

## Decisions to confirm (`TODO(VERIFY)`)
- **No emergency level.** The guideline explicitly doesn't address hypertensive crisis, so no reading sends people to "go to hospital now". Urgent symptoms are covered by the shared urgent screen. Should a clinician-approved crisis level be added, and from which source?
- **"High cardiovascular risk"** (Recommendations 1 and 6) isn't used, because the BP check doesn't run the WHO CVD chart. Only heart disease, diabetes and kidney disease from the profile trigger the 130 rule.
- **"Known heart disease or stroke"** in the profile is treated as "existing cardiovascular disease".
- **Pregnancy:** the source's pregnancy treatment level is ≥160/≥105. The app sends any pregnant woman with ≥140/90 to a doctor or midwife "soon", because the source says diagnosis needs two readings and that it "must be diagnosed … and followed up diligently". The app doesn't screen for pre-eclampsia symptoms.
- **Wording "WHO advises"** covers both "recommends" (heart disease, strong) and "suggests" (diabetes or kidney disease, conditional).

## Tests
- `src/domain/modules/bp-check/definition.test.ts`:
  - the 140/90 and 160/100 boundaries;
  - the treatment target paths;
  - the 130 rule for each condition;
  - pregnancy;
  - an unknown bottom number;
  - every band reachable with km/en text.
- `tests/e2e/check-bp.e2e.ts`: three readings in a browser at 375 px, in English and Khmer.

## Review
No review record yet (`docs/references/reviews/`).
