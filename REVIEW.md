# What needs your review

You asked me to build through all phases without stopping, never invent medical numbers, and list what needs your review. This is that list, most urgent first. Each item says what to do and where.

---

## ✅ 1. Deploy: done (23 Nov 2026)

- **Live site:** https://sokhapheap-6c0l.onrender.com (Render free plan, Singapore). `/api/health` OK with 1,440 facilities.
- **GitHub:** https://github.com/Arunratanak/Sokhapheap (`main`). CI is green.
- **Database:** migrations 0001–0003 applied, 1,440 facilities seeded, and all `scripts/check_db.ts` checks pass (anon locked out, service role can write).
- **Telegram:** the @SokhaPheapBot webhook points at the live site.
- **Daily reminders:** GitHub Actions secrets `APP_URL` and `CRON_SECRET` are set, and a manual run is green.
- **Free plan:** the service sleeps after 15 minutes idle. Warm it up before Demo Day (see `DEMO_SCRIPT.md`), or decide on a paid instance for that week. I won't upgrade anything without your yes.

### ⚠️ Still open: Gemini quota
During testing, `gemini-3.8-flash` started returning **429 "exceeded your current quota"**. That's the free-tier daily limit, used up by my evaluation runs. `gemini-3.5-flash-lite` still works, and the app falls back automatically: Flash, then Flash-Lite, then template text. For Demo Day, consider enabling billing on the Gemini project, or check the quota in AI Studio the day before.

---

## 🟠 2. Medical content: clinician sign-off needed

### 2a. Lab normal ranges (`src/lib/scoring/labRanges.ts`). All are marked `verified: false`.
These ranges are used **only when the report doesn't print its own range**. I took them from guidelines, not from memory, and you or a clinician need to confirm them and add `VERIFIED_BY: <name>, <date>`.

| Test | "Normal" in app | Source | Open question |
|---|---|---|---|
| Fasting glucose | < 100 mg/dL (5.6 mmol/L) | ADA Standards of Care 2026, Table 2.2 | No lower limit set (hypoglycaemia). Add one? |
| Random glucose | **none** | No guideline normal range | Leave as "could not check" without a printed range, or choose a cut-off? |
| HbA1c | < 5.7 % | ADA 2026, Table 2.2 | — |
| Total cholesterol | < 200 mg/dL | NCEP ATP III | — |
| LDL | < 100 mg/dL ("optimal") | NCEP ATP III | Many labs print < 130. Which one? |
| HDL | ≥ 40 mg/dL | NCEP ATP III | Use ≥ 50 for women? |
| Triglycerides | < 150 mg/dL | NCEP ATP III | — |
| Creatinine | **none** | Lab-, method- and sex-specific | Leave as printed range only? |

Unit conversions use standard molar-mass factors: glucose 18.016, cholesterol 38.67, TG 88.57, creatinine 88.42, and HbA1c IFCC→NGSP `/10.929 + 2.15`.

### 2b. WHO CVD chart: please verify 10 cells against the official PDF
**Source:** WHO HEARTS technical package, *Risk-based CVD management* (2020, ISBN 9789240001367), **PDF page 65**, "South-East Asia" non-laboratory chart. The page lists Cambodia. The 700 cells were read automatically from the PDF's text layer, not typed by hand. The script checks that exactly 700 cells were found and that risk never decreases with age, blood pressure or smoking. I also checked visually against the rendered page; 9 of the 10 cells below were confirmed that way.

| Sex | Smoking | Age | SBP | BMI | App value |
|---|---|---|---|---|---|
| Men | Non-smoker | 40-44 | <120 | <20 | **1%** |
| Men | Smoker | 45-49 | 140-159 | 25-29 | **9%** |
| Women | Non-smoker | 50-54 | 160-179 | ≥35 | **7%** |
| Women | Smoker | 55-59 | ≥180 | 20-24 | **19%** |
| Men | Non-smoker | 60-64 | 120-139 | 30-35 | **9%** |
| Men | Smoker | 65-69 | 160-179 | ≥35 | **31%** |
| Women | Non-smoker | 70-74 | ≥180 | <20 | **21%** |
| Women | Smoker | 40-44 | <120 | ≥35 | **4%** |
| Men | Smoker | 70-74 | ≥180 | ≥35 | **44%** |
| Women | Non-smoker | 65-69 | 120-139 | 25-29 | **9%** |

When confirmed, change `VERIFIED_BY: TODO(VERIFY)` in `scripts/extract_who_cvd_chart.ts` and run `npm run data:who-chart`.

**Decisions to confirm:**
- **Non-integer BMI:** I treat the columns as `<20 | 20–<25 | 25–<30 | 30–<35 | ≥35`. For example, 24.6 falls in "20-24" and exactly 35 falls in "≥35".
- **Band words:** the WHO legend only gives percentages. I added the labels **Low** (<5%), **Moderate** (5–<10%), **High** (10–<20%) and **Very high** (20–<30% and ≥30%).

### 2c. Rules I chose that a clinician should confirm
- **"See a doctor in the next few weeks"** is shown when FINDRISC is high or very high (≥15), or WHO risk is ≥20%. The "blood sugar test" step at FINDRISC ≥12 comes from your prompt.
- **"Check again in about a year"** is shown for low-risk results.
- **Urgent screen:** chest pain or tightness, fainting, or signs of very high blood sugar (extreme thirst, lots of urine, confusion, very sleepy) lead to "Go to a hospital now".
- **Ambulance number 119** is shown on the urgent screen. Please confirm it's the right number to show nationwide.
- **FINDRISC Asian cut-offs** are disabled, with values left as `TODO(VERIFY)` (candidate sources are noted in the code). The standard FINDRISC cut-offs are used.

---

## 🟡 3. Khmer wording (Phase 6 🛑): native speaker review
All Khmer text is my draft: `src/lib/i18n/km.json` (questions, results, urgent screen, bot messages) and the Khmer test names in `labRanges.ts`. Please have a native speaker go through `/km/risk`, `/km/lab`, `/km/map` and the bot on a phone. Focus on:
- medical terms: ហានិភ័យ, ជំងឺទឹកនោមផ្អែមប្រភេទទី ២, គាំងបេះដូង, ដាច់សរសៃឈាមខួរក្បាល
- the waist-measuring tip and the family-history options
- the Khmer test names (អេម៉ូក្លូប៊ីន A1c, គ្រីអាទីនីន, ទ្រីគ្លីសេរីដ)

Khmer line breaking: I insert invisible break points between words so text wraps on phones. Report any word that splits in the wrong place.

**Font change since your Phase 1 check:** to load faster on 3G, the app now uses **Noto Sans Khmer only**. Kantumruy Pro was removed. Please re-check the font on your phone.

---

## 🟡 4. AI tone and safety (Phase 8 🛑)
Full results are in `tests/fixtures/ai_eval_report.md`.
- **Extraction:** 10/10 fake reports fully correct (value, unit and printed range). Do you have a real but anonymised Cambodian lab report to test with?
- **Tricky questions:** 8/10 passed the automatic check, and the 2 "failures" are false positives: refusals that mention "herbal" and "I cannot tell you that you are healthy". All 10 answers refused to diagnose or prescribe and pointed to a doctor. Please read them.
- **Problem found and fixed:** Flash-Lite sometimes mixed **Thai and Thaana characters** into Khmer output (for example "รอบเอว"). Explanations are now rejected if they contain any non-Khmer/Latin script. The app then tries the next model and falls back to the template text, so users never see the mixed text.
- Please read the 5 sample Khmer explanations in the report for tone.

---

## 🟢 5. Things to test on your phone
- [ ] **Web:** `npm run dev -- --hostname 0.0.0.0`, then open `http://<PC-IP>:3000` on the same Wi-Fi.
- [ ] **Bot (@SokhaPheapBot):** run `npm run bot:dev` (long polling) and try `/start`, `/check`, sending your location, sending a lab photo, and `/remind`. Reminders only save once the migrations are applied (1a).
- [ ] **Org dashboard:** `/km/org/DEMO` with your `ORG_DASHBOARD_ACCESS_CODE`. Demo data appears after the migrations.

---

## 🔵 6. Known issues and options

### Map load on Fast 3G: 4.1 s (target < 3 s) ❌
Measured with `tests/e2e/map-3g.e2e.ts` (cold cache, 562 ms RTT, 1.6 Mbps). The page and controls appear at about 1.3 s; all markers are drawn at about 4.1 s. I tried two fixes: preloading the data and shrinking the payload (5.6 → 4.6 s), then dropping the second font (4.6 → 4.1 s). Your prompt says to stop after two attempts and offer options:
1. **Accept it.** It's 4.1 s on a cold cache and much faster on repeat visits (data cached for 24 h). The nearest-facility list doesn't depend on the map.
2. **Show the list first** and load the map only when the user taps "Show map". This should get under 3 s. About 30 minutes of work.
3. **Pre-render a static map image** for first paint, then swap in the interactive map. More work; I don't think it's worth it before Demo Day.

### Facility data quality
- OSM includes some mislabelled places, for example "Praram 9 Hospital Cambodia Office" (an office tagged as a hospital), and specialist clinics (eye, dermatology) can appear as "nearest". Fix options: correct them upstream in OSM, keep a small exclusion list, or rank hospitals and health centres first.
- The MoH dataset licence is listed as "Other" on HDX. Please check its dataset page before Demo Day.

### Other
- The bot keeps conversation state in memory, so it's lost if the free instance restarts mid-conversation.
- Lighthouse itself couldn't be run here (the command was blocked by the sandbox). Accessibility was checked with **axe-core**, the engine behind Lighthouse's accessibility score: 0 violations on 7 pages and states, in both languages. Run Lighthouse in Chrome DevTools to get the official score.
