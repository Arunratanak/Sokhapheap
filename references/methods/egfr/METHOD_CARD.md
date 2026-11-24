# Method card (DRAFT, Phase 2 research): Kidney function from a creatinine result (eGFR)

| | |
|---|---|
| **Module id** | `egfr` |
| **Status** | research draft (not built) |
| **Health area** | Kidney |
| **Sensitivity** | normal |
| **Tool** | CKD-EPI 2021 creatinine equation (race-free); CKD G-stage by eGFR as reference |
| **Source** | Inker LA et al. New creatinine- and cystatin C–based equations to estimate GFR without race. *NEJM* 2021;385:1737–49. doi:10.1056/NEJMoa2102953 (PMC8822996) — https://pmc.ncbi.nlm.nih.gov/articles/PMC8822996/ |
| **Archived** | ✅ local only: `references/sources/private/CKD-EPI_2021_Inker_NEJM.pdf` (copyrighted, git-ignored; sha256 `6a5cd727fef2373b41eb00cfb3d5360c5faae8b598524563022b684f8bdcaf27`) · Staging table source (KDIGO) not yet archived. |
| **Validation (Asian / Cambodian)** | Developed mostly in US cohorts; widely recommended. Asian-specific calibration not established (TODO: literature). |
| **Validated Khmer version** | N/A (lab value) |
| **Licence / permission** | Formula: OK to implement; paper copyrighted (not redistributed) |
| **Effort** | S |
| **Eligibility** | Adults with a confirmed creatinine value (from the lab explainer), age and sex. |
| **Recommendation** | **Include** |

## Notes
Coefficients must be copied from the archived paper (not memory). Show stage as reference with 'one value is not a diagnosis; confirm with a doctor'.

## Items, scoring and cut-offs
**Not written yet, on purpose.** They will be quoted word for word from the archived source once you approve this module (rule 2: never from memory). Worked examples for the tests will also come from the source.

## Red flags / next steps / monitor interval
To be taken from the source guideline when the module is built; anything not in the source stays `TODO(VERIFY)` for the clinician.

_Researched 23 Nov 2026. Search results only — every claim above must be re-checked against the archived source before building._
