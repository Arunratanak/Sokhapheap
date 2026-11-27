// Generates draft METHOD_CARD.md files for the Phase 2 candidate modules from the research below.
// Research date: 23 Nov 2026. Run: node scripts/data/write_method_cards.mjs
import fs from "node:fs";
import path from "node:path";

const archived = (f, sha) => `✅ \`docs/references/sources/${f}\` (sha256 \`${sha}\`)`;
const privateArc = (f, sha) => `✅ local only: \`docs/references/sources/private/${f}\` (copyrighted, git-ignored; sha256 \`${sha}\`)`;
const notArchived = (why, url) => `❌ not archived: ${why}. Download manually from ${url} into \`docs/references/sources/\`.`;

const C = [
  {
    id: "who-cvd-lab", title: "Heart attack and stroke risk, laboratory-based (WHO 2019 chart)", area: "Heart", sens: "normal",
    tool: "WHO CVD risk laboratory-based chart, South-East Asia (uses total cholesterol and diabetes status)",
    source: "WHO HEARTS technical package, *Risk-based CVD management*, 2020 (R-WHO-HEARTS-2020), Annex 3", sourceUrl: "https://www.who.int/publications/i/item/9789240001367",
    archive: archived("WHO_HEARTS_risk-based-CVD-management_2020.pdf", "1f836448bc5f0455b717d9c1d6fc4cb057a286b8303fa940bf14c356785e2510"),
    validation: "Same as the non-lab chart: recalibrated for the WHO South-East Asia chart group (which lists Cambodia); not validated in a Cambodian cohort.",
    khmer: "N (numbers only; band words need Khmer review)", licence: "Y: CC BY-NC-SA 3.0 IGO (non-commercial)", effort: "M",
    eligibility: "Ages 40–74 (chart axis), with a cholesterol value from a confirmed lab result and diabetes status.",
    notes: "The exact lab-chart page number and table must be extracted from the archived PDF (same method as the non-lab chart, 700+ cells). Cholesterol is taken from the lab explainer after the user confirms it.",
    rec: "Include",
  },
  {
    id: "bp-check", title: "Blood pressure check", area: "Heart", sens: "normal",
    tool: "Interpretation of a blood pressure reading against the WHO 2021 hypertension guideline (not a risk score)",
    source: "WHO. *Guideline for the pharmacological treatment of hypertension in adults*. 2021. ISBN 9789240033986", sourceUrl: "https://www.who.int/publications/i/item/9789240033986",
    archive: notArchived("WHO IRIS and NCBI Bookshelf returned an HTML page to automated download", "https://www.who.int/publications/i/item/9789240033986"),
    validation: "Official WHO guideline (global). Treatment threshold found in the executive summary: SBP ≥ 140 or DBP ≥ 90 mmHg in people with confirmed hypertension (to be quoted from the archived PDF).",
    khmer: "N/A (a reading, not a questionnaire); explanation text needs Khmer review", licence: "Y: CC BY-NC-SA 3.0 IGO", effort: "S",
    eligibility: "Adults who enter a reading; encourages measuring at a health centre or pharmacy if unknown.",
    notes: "**Red-flag threshold is not in this guideline** (it excludes hypertensive emergencies). A very-high-reading red flag needs a separate official source (e.g. the WHO HEARTS *Evidence-based treatment protocols* module); none archived yet. No red-flag value will be written from memory.",
    rec: "Include with caution (needs a sourced red-flag threshold + clinician)",
  },
  {
    id: "weight-waist", title: "Weight and waist", area: "Metabolic", sens: "normal",
    tool: "WHO BMI categories with the WHO Expert Consultation's Asian public-health action points; waist cut-offs (WHO 2008 waist report / IDF 2006)",
    source: "WHO Expert Consultation. Appropriate body-mass index for Asian populations… *Lancet* 2004;363:157–163 (action points 23, 27.5, 32.5, 37.5 kg/m²; international cut-offs retained)", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/14726171/",
    archive: notArchived("Lancet full text is paywalled; WHO waist-circumference report and IDF consensus not yet located as downloadable PDFs", "the publisher / WHO IRIS"),
    validation: "The consultation itself was about Asian populations; it did not set population-specific cut-offs.",
    khmer: "N/A (measurements); explanation text needs Khmer review", licence: "Lancet: copyrighted (cite, don't redistribute); WHO: CC BY-NC-SA", effort: "S",
    eligibility: "Adults; not during pregnancy.", notes: "Interpretation only; feeds other modules. Which cut-off set to show (international vs Asian action points) is a clinician decision.",
    rec: "Include (after sources are archived and the clinician picks the cut-off set)",
  },
  {
    id: "ckd-scored", title: "Chronic kidney disease risk (questionnaire)", area: "Kidney", sens: "normal",
    tool: "SCORED (Screening for Occult Renal Disease), Bang et al. 2007", source: "Bang H et al., *Arch Intern Med* 2007 (original paper not yet located)", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/?term=SCORED+Bang+2007",
    archive: notArchived("original paper not located open access", "the publisher"),
    validation: "Asian validation study (AstraZeneca SCREEN, NCT05866276; Indonesia + Vietnam; 1,426 patients; completed 31 May 2024) has **no published results** found. A Hong Kong pilot proposed a shorter SCORED-M.",
    khmer: "N", licence: "Unknown (TODO)", effort: "M", eligibility: "Adults (per source; TODO)",
    notes: "Without Asian results, the eGFR module (lab-based, guideline formula) is the stronger kidney option for Demo Day.",
    rec: "Skip for now (roadmap); revisit when SCREEN results are published",
  },
  {
    id: "egfr", title: "Kidney function from a creatinine result (eGFR)", area: "Kidney", sens: "normal",
    tool: "CKD-EPI 2021 creatinine equation (race-free); CKD G-stage by eGFR as reference", source: "Inker LA et al. New creatinine- and cystatin C–based equations to estimate GFR without race. *NEJM* 2021;385:1737–49. doi:10.1056/NEJMoa2102953 (PMC8822996)", sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8822996/",
    archive: privateArc("CKD-EPI_2021_Inker_NEJM.pdf", "6a5cd727fef2373b41eb00cfb3d5360c5faae8b598524563022b684f8bdcaf27") + " · Staging table source (KDIGO) not yet archived.",
    validation: "Developed mostly in US cohorts; widely recommended. Asian-specific calibration not established (TODO: literature).", khmer: "N/A (lab value)", licence: "Formula: OK to implement; paper copyrighted (not redistributed)", effort: "S",
    eligibility: "Adults with a confirmed creatinine value (from the lab explainer), age and sex.",
    notes: "Coefficients must be copied from the archived paper (not memory). Show stage as reference with 'one value is not a diagnosis; confirm with a doctor'.",
    rec: "Include",
  },
  {
    id: "tb-symptom", title: "Tuberculosis symptom screen", area: "Lungs", sens: "normal",
    tool: "WHO TB screening guideline (symptom screen) + Cambodian National TB Programme (CENAT) presumptive-TB criteria", source: "WHO. *Consolidated guidelines on tuberculosis, Module 2: Screening*. 2021. ISBN 9789240022676", sourceUrl: "https://www.who.int/publications/i/item/9789240022676",
    archive: notArchived("download returned HTML (LSTM mirror and WHO IRIS)", "https://www.who.int/publications/i/item/9789240022676") + " Cambodia NSP 2021–2030 PDF also blocked: https://extranet.who.int/cpcd/sites/default/files/public_file_repository/KHM_Cambodia_National-Strategic-Plan-to-end-TB_2021-2030.pdf",
    validation: "Published Cambodian programme criteria (in peer-reviewed reports): cough, fever, night sweats or weight loss lasting ≥ 2 weeks; CENAT-endorsed description: cough > 2 weeks plus at least one general symptom. Cambodia's 3rd national prevalence survey: **43% of people with TB reported no cough**, so a symptom screen misses many cases (state this honestly). TB diagnosis and treatment are **free** in Cambodia.",
    khmer: "N (no validated Khmer item set found; needs CENAT wording or approval)", licence: "Y (WHO CC BY-NC-SA; national programme criteria)", effort: "S",
    eligibility: "Everyone (adults first).", notes: "Any positive → 'get a free TB test'. Coughing blood → red flag. Facility data has no service field, so route to the nearest health centre and say so. **High priority for Cambodia.**",
    rec: "Include (highest priority)",
  },
  {
    id: "copd", title: "COPD (chronic lung disease) screen", area: "Lungs", sens: "normal",
    tool: "**COPD-SQ** (7 items incl. biomass/cooking smoke; Zhou et al. *IJTLD* 2013) — compared with COPD-PS (5 items)", source: "Zhou YM et al. *Int J Tuberc Lung Dis* 2013 (doi 10.5588/ijtld.12.0995); form reproduced in an ERJ Open Research 2022 supplement", sourceUrl: "https://publications.ersnet.org/content/erjor/9/2/00597-2022/DC1/embed/inline-supplementary-material-1.pdf",
    archive: notArchived("original paywalled; ERS supplement blocked by a bot check", "https://publications.ersnet.org/content/erjor/9/2/00597-2022/DC1/embed/inline-supplementary-material-1.pdf"),
    validation: "Developed on 19,800 adults ≥ 40 in China; recommended by the Chinese COPD guideline (2021) where spirometry is unavailable. Beijing 2023 comparison: COPD-SQ and COPD-PS comparable overall, **COPD-SQ better in rural areas**. COPD-PS validated in China (meta-analysis, AUC ≈ 0.79) and Japan.",
    khmer: "N", licence: "TODO (check terms for COPD-SQ; COPD-PS is a published instrument)", effort: "M",
    eligibility: "Adults ≥ 40 (development population).", notes: "Recommend COPD-SQ for its biomass item (rural Cambodian cooking smoke). Next step: spirometry at a referral hospital.",
    rec: "Include with caution (COPD-SQ; no Cambodian validation)",
  },
  {
    id: "stop-bang", title: "Obstructive sleep apnea", area: "Lungs", sens: "normal",
    tool: "STOP-Bang (Chung et al. *Anesthesiology* 2008)", source: "Chung F et al. *Anesthesiology* 2008;108(5):812–821", sourceUrl: "https://www.stopbang.ca",
    archive: privateArc("STOP-Bang_form_FAA.pdf", "e47781a787edf1068f983d94182172294c028f6557c2a3ebad1ab5cb1c15344b"),
    validation: "Validated in Asian populations (Singapore 2010, Japan 2020 with BMI cut-off 30 for Asians; meta-analyses).", khmer: "N",
    licence: "**N: needs permission from the developer** (Dr Frances Chung / University Health Network)", effort: "S",
    eligibility: "Adults.", notes: "Optional module; useful link to heart/BP risk.", rec: "Skip unless you obtain permission",
  },
  {
    id: "smoking", title: "Smoking: dependence and quit support", area: "Lungs", sens: "normal",
    tool: "Heaviness of Smoking Index (HSI, 2 items) — shorter alternative to the Fagerström test (FTND)", source: "HSI vs FTND comparison (PMC2809067); Malaysian validations (Lim 2012; Tobacco Induced Diseases 2022)", sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2809067/",
    archive: notArchived("PMC download blocked by a bot check", "https://pmc.ncbi.nlm.nih.gov/articles/PMC2809067/"),
    validation: "HSI validated in Malaysian clinic/population samples (high dependence ≥ 4 reported); agreement with FTND varies. No Cambodian validation.",
    khmer: "N", licence: "TODO (FTND/HSI terms)", effort: "S",
    eligibility: "Current smokers (from the profile).", notes: "**No Cambodian quitline or cessation service found** — you must provide/confirm the services before this module can give a next step.",
    rec: "Include with caution (after you confirm quit services)",
  },
  {
    id: "audit-c", title: "Harmful alcohol use", area: "Liver", sens: "sensitive",
    tool: "AUDIT-C (first 3 items of the WHO AUDIT)", source: "Babor TF et al. *AUDIT: guidelines for use in primary care*, 2nd ed. WHO 2001 (WHO/MSD/MSB/01.6a). AUDIT-C cut-offs: Bush et al. 1998 (not located)", sourceUrl: "https://www.who.int/publications/i/item/who-msd-msb-01.6a",
    archive: archived("WHO_AUDIT_manual_2001.pdf", "b1ece4a19906cd9347f87df73db25f27d6dfb229a1e198cba31bd0828662a6a1") + " (AUDIT items and full-AUDIT scoring). AUDIT-C cut-off paper not archived.",
    validation: "AUDIT is WHO's international tool; AUDIT-C cut-offs vary by sex and population (TODO: Asian/Cambodian evidence).", khmer: "N (WHO lists English, Spanish, Portuguese, Japanese)", licence: "Y: WHO manual (AUDIT is free to use)", effort: "S",
    eligibility: "Adults; opt-in.", notes: "Sensitive: never saved by default, never sent to AI with identity, excluded from statistics.",
    rec: "Include with caution (needs a validated Khmer version or your approval; AUDIT-C cut-off source)",
  },
  {
    id: "hepatitis-testing", title: "Hepatitis B and C: should I get tested?", area: "Liver", sens: "sensitive",
    tool: "WHO testing recommendations (who should be offered HBsAg / anti-HCV testing) — a recommendation, not a score", source: "WHO. *Guidelines on hepatitis B and C testing*. 2017. ISBN 9789241549981", sourceUrl: "https://www.who.int/publications/i/item/9789241549981",
    archive: archived("WHO_hepatitis_BC_testing_2017.pdf", "8c7cbdc7ca28cce45e2dcfb5d6b68165b4a88c6c573e0ba9a695a31c587a29c4"),
    validation: "Official WHO guideline for low- and middle-income countries. Where HBsAg prevalence ≥ 2% or ≥ 5%, routine testing is offered to all adults; focused testing for high-risk groups (to be quoted from the PDF).",
    khmer: "N (risk questions need Khmer wording + review)", licence: "Y: CC BY-NC-SA 3.0 IGO", effort: "S",
    eligibility: "Adults; opt-in.", notes: "Needs Cambodia's HBsAg prevalence from an open source to decide 'routine' vs 'focused' testing. Where to test in Cambodia must be confirmed by you.",
    rec: "Include with caution",
  },
  {
    id: "phq9", title: "Depression (PHQ-2 → PHQ-9)", area: "Mind", sens: "sensitive",
    tool: "PHQ-9 (with PHQ-2 first step)", source: "Kroenke K et al. *J Gen Intern Med* 2001 (PMC1495268); **Cambodia validation: Steinman, Phal, Srou, Ung, *PLOS Mental Health* 2025;2(4) (PMC12798203)**", sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12798203/",
    archive: notArchived("PMC download blocked by a bot check (PLOS = CC BY, can be archived)", "https://pmc.ncbi.nlm.nih.gov/articles/PMC12798203/"),
    validation: "**Validated in Cambodia (2025; 498 patients; strong correlation with HSCL/HTQ).** Whether the study used a published Khmer version, and which cut-off it recommends, must be read from the full paper.",
    khmer: "Possibly (to confirm from the Cambodian validation paper)", licence: "Y: PHQ is free to use (no permission needed, per the PHQ screeners terms — TODO confirm)", effort: "M",
    eligibility: "Adults; opt-in.", notes: "Requires the Phase 4 crisis protocol (item 9) and crisis contacts from you before going live. No AI chat.",
    rec: "Include with caution (after Phase 4 + Khmer version confirmed)",
  },
  {
    id: "gad7", title: "Anxiety (GAD-2 → GAD-7)", area: "Mind", sens: "sensitive",
    tool: "GAD-7 (with GAD-2 first step)", source: "Spitzer RL et al. *Arch Intern Med* 2006 (not located OA); **Cambodia validation: same 2025 PLOS Mental Health study**", sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12798203/",
    archive: notArchived("original paywalled; Cambodian paper blocked by a bot check", "https://pmc.ncbi.nlm.nih.gov/articles/PMC12798203/"),
    validation: "**Validated in Cambodia (2025).**", khmer: "Possibly (as PHQ-9)", licence: "Y: free to use (TODO confirm)", effort: "M",
    eligibility: "Adults; opt-in.", notes: "Same safety rules as PHQ-9.", rec: "Include with caution (with PHQ-9)",
  },
  {
    id: "osta", title: "Osteoporosis risk (OSTA)", area: "Bones", sens: "normal",
    tool: "OSTA (age and weight only; Koh et al. *Osteoporos Int* 2001;12:699–705)", source: "Koh LK et al. 2001 (paywalled); validation: Beijing postmenopausal women (BMC Musculoskelet Disord 2013, CC BY)", sourceUrl: "https://link.springer.com/article/10.1186/1471-2474-14-271",
    archive: archived("OSTA_Beijing_validation_2013.pdf", "8ca1dba43a7c5a9b93727ef17d9fac51ccdb8f6b150f895dd8dfecddb37afd30") + " (validation study; the original formula paper is not archived)",
    validation: "Developed in 8 Asian countries (mostly East Asian). Mixed results: Beijing cut-off −1 gave sensitivity 66% / specificity 76%; a **Malaysian cohort found the original cut-offs ineffective**. Reviews say re-validate locally before use.",
    khmer: "N/A (age + weight)", licence: "Formula published; paper copyrighted", effort: "S",
    eligibility: "Postmenopausal women (per source).", notes: "No South-East Asian support for the original cut-off; false reassurance risk.",
    rec: "Skip for now (roadmap)",
  },
  {
    id: "cervical-reminder", title: "Cervical cancer screening reminder", area: "Women's health", sens: "normal",
    tool: "WHO 2021 guideline (age range and interval) — a reminder, not a risk score", source: "WHO. *Guideline for screening and treatment of cervical pre-cancer lesions*, 2nd ed. 2021. ISBN 9789240030824", sourceUrl: "https://www.who.int/publications/i/item/9789240030824",
    archive: notArchived("WHO IRIS / NCBI download returned HTML", "https://www.who.int/publications/i/item/9789240030824"),
    validation: "Official WHO guideline: general population — HPV DNA testing from age 30, every 5–10 years; women living with HIV — from 25, every 3–5 years; rapid transition away from VIA recommended (to be quoted from the PDF).",
    khmer: "N/A (reminder text needs Khmer review)", licence: "Y: CC BY-NC-SA 3.0 IGO", effort: "S",
    eligibility: "Women in the guideline age range.", notes: "**Cambodian public screening services (VIA vs HPV, which facilities) not found online — you must confirm.** Do not ask about HIV status unless approved (sensitive).",
    rec: "Include (after you confirm Cambodian services)",
  },
];

const root = path.resolve("docs/references/methods");
for (const c of C) {
  const dir = path.join(root, c.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "METHOD_CARD.md"),
    `# Method card (DRAFT, Phase 2 research): ${c.title}

| | |
|---|---|
| **Module id** | \`${c.id}\` |
| **Status** | research draft (not built) |
| **Health area** | ${c.area} |
| **Sensitivity** | ${c.sens} |
| **Tool** | ${c.tool} |
| **Source** | ${c.source} — ${c.sourceUrl} |
| **Archived** | ${c.archive} |
| **Validation (Asian / Cambodian)** | ${c.validation} |
| **Validated Khmer version** | ${c.khmer} |
| **Licence / permission** | ${c.licence} |
| **Effort** | ${c.effort} |
| **Eligibility** | ${c.eligibility} |
| **Recommendation** | **${c.rec}** |

## Notes
${c.notes}

## Items, scoring and cut-offs
**Not written yet, on purpose.** They will be quoted word for word from the archived source once you approve this module (rule 2: never from memory). Worked examples for the tests will also come from the source.

## Red flags / next steps / monitor interval
To be taken from the source guideline when the module is built; anything not in the source stays \`TODO(VERIFY)\` for the clinician.

_Researched 23 Nov 2026. Search results only — every claim above must be re-checked against the archived source before building._
`,
  );
}
console.log(`wrote ${C.length} method cards`);
fs.writeFileSync(path.join(root, "candidates.json"), JSON.stringify(C.map(({ id, title, area, sens, rec, effort, khmer, licence }) => ({ id, title, area, sens, rec, effort, khmer, licence })), null, 1) + "\n");
