# SokhaPheap (សុខភាព)

SokhaPheap is a Khmer-first web app and Telegram bot that helps Cambodian adults **understand their health risk early and get to care**. It was built for the Open Data × AI Venture Hackathon in Phnom Penh, with Demo Day on 26 December 2026.

1. **Risk check:** a short questionnaire calculates type 2 diabetes risk (FINDRISC) and 10-year heart attack and stroke risk (WHO 2019 non-laboratory chart, South-East Asia).
2. **Blood test explainer:** a photo of a lab report goes to AI, which reads the values. The user confirms or edits them, the app compares them with the range printed on the report or with guideline ranges, and AI explains the result in simple Khmer.
3. **Next step and facility map:** every result ends with a clear next step and the nearest hospitals, health centres and clinics, built from **Cambodian open data**.

> ⚠️ នេះមិនមែនជាការធ្វើរោគវិនិច្ឆ័យទេ។ សូមពិគ្រោះជាមួយវេជ្ជបណ្ឌិត។ This is not a diagnosis. Please consult a doctor.

## Architecture

```
Browser (Next.js, km/en) ─┐                ┌─ src/lib/scoring   FINDRISC · WHO CVD table · lab ranges   (pure code, no AI)
Telegram (@SokhaPheapBot) ┼─► Next.js API ─┼─ src/lib/ai        Gemini: lab extraction + explanation    (fallback: templates)
GitHub Actions (daily) ───┘   routes       ├─ src/lib/facilities  data/clean/facilities.geojson         (open data)
                                           └─ Supabase          facilities (public read) · screenings · reminders · organizations (RLS)
```

- **Risk is calculated by code, never by AI.** AI only reads lab photos and explains results it is given. Explanation output is filtered for drug names, doses, diagnoses and stray non-Khmer scripts. If it fails the filter, the next model is tried, then a fixed template.
- **No personal data.** Screenings are saved with score bands, province and an optional org code only. Lab photos are processed in memory and discarded.
- **Works without AI or the database.** Explanations fall back to templates, and facility search falls back to the bundled open-data file.

| Layer | Choice |
|---|---|
| App and API | Next.js 16 (App Router), TypeScript, Tailwind 4 |
| Database | Supabase Postgres with RLS. The anon key can only read `facilities`. |
| AI | Google Gemini via `@google/genai`. `AI_MODEL` (default `gemini-3.8-flash`), with `AI_MODEL_FAST` (`gemini-3.5-flash-lite`) as fallback. |
| Map | Leaflet and react-leaflet, OpenStreetMap tiles, canvas markers |
| Bot | grammy, webhook at `/api/telegram` (secret token), long polling for local dev |
| Tests | Vitest (unit and API), Playwright-core with Edge (UI e2e, axe accessibility) |
| Hosting | Render free Web Service (Singapore) via `render.yaml`. Daily reminders run from GitHub Actions. |

## Open data sources

See [`data/SOURCES.md`](data/SOURCES.md) and the in-app About page.

- **Ministry of Health health facilities (2010)**, via HDX: referral hospitals, health centres and health posts
- **OpenStreetMap health facilities** (HOT export, via HDX, ODbL)
- **Subnational administrative boundaries** (MLMUPC/WFP, via HDX, CC BY-IGO)
- **WHO CVD risk charts**, HEARTS technical package 2020, p. 65 (CC BY-NC-SA 3.0 IGO)

The cleaning pipeline converts the MoH 2010 coordinates from Indian 1960 / UTM 48N to WGS84. Checked against OSM, the result is a median of about 75 m from the matching OSM hospital. The pipeline then assigns province and district by point-in-polygon and removes same-type duplicates within 200 m, keeping the OSM record. The result is **1,440 facilities in all 25 provinces** ([report](data/clean/facilities_report.md)).

## Run locally

```bash
npm install
cp .env.example .env          # fill in the keys
npm run dev                   # http://localhost:3000  (/km and /en)

npm test                      # unit + API tests
npm run test:coverage         # scoring coverage (target ≥ 90%)
npm run build && npx next start -p 3100
BASE_URL=http://localhost:3100 npm run test:e2e   # 10 FINDRISC cases through the UI + axe a11y

npm run data:facilities       # re-download + rebuild facilities.geojson
npm run data:who-chart        # regenerate the WHO table from the official PDF
npm run db:migrate            # apply supabase/migrations + seed facilities (needs SUPABASE_DB_URL, session pooler)
npm run ai:eval               # extraction accuracy + tricky questions + Khmer samples (uses Gemini)
npm run bot:dev               # Telegram bot in long-polling mode (deletes webhook)
npm run bot:webhook           # point the bot back at NEXT_PUBLIC_SITE_URL/api/telegram
```

## Deploy (Render)

1. Push to GitHub.
2. In Render: **New → Blueprint**, select the repo, and enter each env var when prompted. They are never committed.
3. After the first deploy, set `NEXT_PUBLIC_SITE_URL=https://<name>.onrender.com` in Render and in your local `.env`, then run `npm run bot:webhook`.
4. In GitHub, go to **Settings → Secrets → Actions** and add `APP_URL` and `CRON_SECRET` for the daily reminder workflow.

The free plan sleeps after 15 minutes without traffic, so the first request afterwards can take up to about a minute. Warm the app up before demos (see `DEMO_SCRIPT.md`).

## Limitations

- FINDRISC and the WHO charts were **developed outside Cambodia** and have not been validated in the Cambodian population. The WHO chart is for ages 40–74 only.
- Part of the facility data is **from 2010**. OSM coverage is uneven and includes some mislabelled places, such as offices tagged as hospitals.
- Lab "normal ranges" vary between laboratories. The app prefers the range printed on the report. The fallback table needs clinician sign-off (see `REVIEW.md`).
- Bot conversation state is held in memory, so it's lost if the free instance restarts mid-conversation.
- The in-memory rate limiter resets on restart. That's acceptable for one instance.

## Known issues and roadmap

See [`REVIEW.md`](REVIEW.md) for open items. Features cut or deferred for later:

- Asian-specific FINDRISC cut-offs. They need validation, so they're disabled.
- Laboratory-based WHO chart (with cholesterol and diabetes status)
- Storing the bot language preference and conversation state in Supabase
- Facility opening hours, phone numbers and services, which the datasets don't include
- Local validation study with a Cambodian partner clinic
