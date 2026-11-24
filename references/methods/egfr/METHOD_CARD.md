# Method card: Kidney function from a creatinine result (module `egfr`)

| | |
|---|---|
| **Status** | `draft` (built 24 Nov 2026; needs clinician sign-off, see `TODO(VERIFY)` below) |
| **Health area** | Kidney |
| **Sensitivity** | normal, **opt-in** (needs a creatinine result) |
| **Tool** | CKD-EPI 2021 creatinine equation (race-free), eGFRcr(AS) |
| **Source** | R-CKD-EPI-2021: Inker LA, Eneanya ND, Coresh J, et al. New creatinine- and cystatin C–based equations to estimate GFR without race. *N Engl J Med* 2021;385:1737–49. doi:10.1056/NEJMoa2102953 |
| **Archived** | ✅ local only: `references/sources/private/CKD-EPI_2021_Inker_NEJM.pdf` (copyrighted, git-ignored; sha256 `6a5cd727fef2373b41eb00cfb3d5360c5faae8b598524563022b684f8bdcaf27`). The equation's coefficients are facts and are implemented; the paper itself isn't redistributed. |
| **Validation (Asian / Cambodian)** | Developed and validated mostly in US and European cohorts. Not validated in a Cambodian population. |
| **Khmer version** | N/A (a lab value). The explanation text is SokhaPheap's (`UNVALIDATED_TRANSLATION`). |

## Equation (Table 2, PDF page 5 / journal page 1741)
Row "2021 CKD-EPI creatinine (2009 CKD-EPI creatinine fit without race); eGFRcr(AS), new":
- μ = **142**
- a1 = **F −0.241 / M −0.302**
- a2 = **−1.200**
- age coefficient c = **0.9938**
- female coefficient d = **1.012**
- no race coefficient

Footnote \*: "eGFR = μ × min (Scr/κ , 1)^a1 × max (Scr/κ , 1)^a2 × … × c^Age × d [if female] …". Here "κ is 0.7 for female participants and 0.9 for male participants".

Units: creatinine in mg/dL. "To convert the values for serum creatinine to micromoles per liter, multiply by 88.4" (PDF page 4). The app accepts mg/dL or µmol/L. The result is rounded to a whole number, in mL/min/1.73 m².

## Stages and thresholds (quoted from the same paper, PDF page 3)
- "guideline-recommended GFR stages (<30, 30 to 44, 45 to 59, 60 to 89, and >90 ml per minute per 1.73 m²)". The app uses ≥90, as in the paper's Table 1.
- "CKD was defined as an eGFR of less than 60 ml per minute per 1.73 m² … or persistent albuminuria".
- "key thresholds for clinical decision making (60, 45, and 30 ml per minute per 1.73 m²)".

The KDIGO guideline the paper cites (its reference 8) isn't archived, so nothing beyond these quotes is used.

## Rules
| eGFR | Band | Urgency | Next step (abridged) |
|---|---|---|---|
| ≥ 60 | `>=90` / `60-89` | low | Not in the range used to define CKD (below 60). Kidney checks can also include a urine protein test; ask your health worker. |
| 45–59, 30–44 | `45-59` / `30-44` | moderate / high | Below 60, the CKD level. One result isn't a diagnosis: show a doctor; ask about repeating the test and a urine protein test. |
| < 30 | `<30` | high | One of the key decision levels: see a doctor in the next few weeks. |
| Creatinine unknown | `unavailable` | not checked | Look for "creatinine" on a recent report, or ask a health centre about a kidney blood test. |

## Decisions to confirm (`TODO(VERIFY)`)
- **Urgency per stage** (45–59 moderate; 30–44 and <30 high) is SokhaPheap's rule.
- **Plausibility range** 0.1–20 mg/dL: values outside it are treated as a wrong unit, not scored. This range is SokhaPheap's, not from the source.
- **Pregnancy, acute illness, very high or low muscle mass:** the equation isn't adjusted for these, and the app doesn't exclude anyone. Should it warn or exclude?
- **"Not a diagnosis" wording:** the paper defines CKD by eGFR <60 or *persistent* albuminuria. The app asks for a repeat test rather than stating a time window, because the chronicity rule (KDIGO) isn't archived.
- **Worked examples** in `src/lib/scoring/ckdEpi2021.test.ts` were calculated by hand from Table 2:
  - woman 50, Scr 0.7 → 105;
  - man 60, Scr 1.0 → 86;
  - man 70, Scr 2.0 → 35;
  - woman 40, Scr 0.5 → 122.

  The clinician should cross-check them against a CKD-EPI 2021 calculator.

## Tests
- `src/lib/scoring/ckdEpi2021.test.ts`: the 4 worked examples, monotonicity, unit conversion and stage boundaries.
- `src/lib/modules/egfr/definition.test.ts`: the bands and next steps, µmol/L input, an unknown value or wrong unit, opt-in, and km/en keys.
- `tests/e2e/check-egfr.e2e.ts`: 177 µmol/L for a man aged 70 shows 35 mL/min/1.73 m² in a browser at 375 px, in English and Khmer.

## Review
No review record yet (`references/reviews/`).
