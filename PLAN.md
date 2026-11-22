# SokhaPheap MVP — Build Plan

Open Data × AI Venture Hackathon, Phnom Penh. Demo Day: **26 December 2026** (about 5 weeks from 22 Nov 2026).

SokhaPheap is a Khmer-first web app and Telegram bot. It estimates diabetes risk (FINDRISC) and heart disease risk (WHO non-lab CVD chart), explains blood test reports in simple Khmer, and points users to the nearest health facility using Cambodian open data. **It does not diagnose.**

## Ground rules (summary)

- Code calculates risk, not AI. Scoring uses pure TypeScript functions and lookup tables, with unit tests.
- No invented medical numbers or dataset contents. Anything unverified is marked `TODO(VERIFY)`, and I stop and ask.
- No personal data. Lab photos stay in memory and are discarded after extraction. Screenings are saved anonymously.
- Secrets go only in `.env.local`, which is git-ignored. `.env.example` has empty keys.
- The Khmer disclaimer appears on every result screen, on both web and bot.
- Git commit at the end of every phase.

## Phases

| # | Phase | Key output | Stop for you? |
|---|---|---|---|
| 0 | Plan and accounts | `PLAN.md`, list of accounts | ✅ Yes: accounts and keys |
| 1 | Scaffold | Next.js + TS + Tailwind, i18n (km default), home page | ✅ Yes: Khmer font on phone |
| 2 | Open data pipeline | `data/clean/facilities.geojson`, report, `SOURCES.md` | ✅ Yes: check 3 known facilities |
| 3 | Scoring engine | FINDRISC, WHO CVD table, lab ranges, tests | ✅ Yes: WHO chart source, lab table verified by a clinician |
| 4 | Database | Supabase migrations, RLS, nearest-facility function | ✅ Yes: migrations applied |
| 5 | API routes | risk, facilities, explain, lab extract and evaluate | — |
| 6 | Risk check UI | Urgent-symptom screen, questionnaire, results | ✅ Yes: Khmer wording review |
| 7 | Facility map | Leaflet map, clustering, fallback dropdowns | — |
| 8 | AI features | Explain and extract prompts, fallbacks, 10 fixtures | ✅ Yes: tone and safety approval |
| 9 | Telegram bot | grammy webhook and polling, `/remind`, GH Actions cron | ✅ Yes: phone test |
| 10 | Org dashboard | `/org/[code]`, aggregates only, groups under 5 hidden | — |
| 11 | Deploy | `render.yaml`, Render free (Singapore), webhook switch | ✅ Yes: Blueprint setup, free vs paid choice |
| 12 | QA and demo prep | README, DEMO_SCRIPT, `?demo=1`, known issues | ✅ Yes: final summary |

If time runs short, I'll cut in this order, last item first: Risk check → Facility map → Deployment → AI explanation → Lab report → Telegram bot → Reminders → Org dashboard.

## Folder structure

```
/data/raw                 downloaded datasets (git-ignored if large)
/data/clean               facilities.geojson, facilities_report.md (committed)
/data/SOURCES.md          dataset name, URL, licence, download date
/scripts                  clean_facilities.ts, seed_facilities.ts, bot-dev.ts
/prompts                  explain.md, extract_lab.md
/supabase/migrations      SQL migrations
/src/app                  pages (/, /risk, /results, /lab, /map, /about, /org/[code])
/src/app/api              risk, facilities/nearest, facilities/by-area, explain,
                          lab/extract, lab/evaluate, telegram, cron/reminders, health
/src/components           UI components (questionnaire steps, map, result cards)
/src/lib/scoring          findrisc.ts, whoCvd.ts, whoCvdTable.ts, labRanges.ts (+ tests)
/src/lib/ai               extract.ts, explain.ts (Anthropic SDK, model from AI_MODEL)
/src/lib/bot              grammy bot logic, shared by webhook and polling
/src/lib/i18n             km.json, en.json
/src/lib/db               Supabase server and public clients
/tests/fixtures           sample questionnaires, lab_reports/*.png + expected JSON
/.github/workflows        reminders.yml (daily), ci.yml (tests)
render.yaml
```

## Technical notes

- **Data cleaning script in TypeScript, not Python.** Python isn't installed on this machine, and keeping one language is simpler. For shapefile → GeoJSON I'll use the `shapefile` npm package, and `@turf/*` for distance checks.
- **Node version:** this machine has Node v24.15.0. I'll set `"engines": { "node": "24.x" }` unless you want a newer LTS.
- **Rate limiting:** an in-memory per-IP limiter. That's fine for a single Render instance, but it resets whenever the service sleeps.
- **Fonts:** Noto Sans Khmer via `next/font/google`, with Kantumruy Pro as an option for headings.

## Questions for you

1. **WHO CVD chart:** Cambodia is in the WHO Western Pacific Region, but the 2019 charts place it in the **Southeast Asia** sub-region group. Do you want me to try to get the official WHO chart, or will you provide the PDF or image? I won't fill the table from memory.
2. **Asian FINDRISC cut-offs** (BMI and waist): should these stay `TODO(VERIFY)` and switched off for the MVP, or do you have a published source you want to use?
3. **Lab ranges:** who on your team (doctor or nurse) will verify the normal-range table, and roughly when? This blocks the end of Phase 3.
4. **Repo:** should it be public or private? A public repo makes it easy for judges to see the code.
5. **Team:** is there a native Khmer speaker available for the Phase 6 wording review? Earlier is better.
6. **Brand:** do you have a logo or colours? If not, I'll use a simple placeholder.

## Accounts and keys you need to create

| # | Account | What I need | Where it goes |
|---|---|---|---|
| 1 | **GitHub** | An empty repo (e.g. `sokhapheap`) and its URL | git remote |
| 2 | **Render** | Sign up with GitHub. Nothing is needed until Phase 11. | Render dashboard |
| 3 | **Supabase** | A new project (region: Singapore). From Project Settings → API: Project URL, anon key, service role key. Also the DB connection string, for running migrations. | `.env.local` |
| 4 | **Anthropic** | An API key from console.anthropic.com, with some credit loaded | `.env.local` |
| 5 | **Telegram** | Message @BotFather → `/newbot` → bot token and username | `.env.local` |

`.env.local` template (I'll also commit this as `.env.example` with empty values):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
ANTHROPIC_API_KEY=
AI_MODEL=claude-sonnet-5-5
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=      # any long random string (I can generate it)
CRON_SECRET=                  # any long random string (I can generate it)
ORG_DASHBOARD_ACCESS_CODE=    # simple access code for /org pages
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
