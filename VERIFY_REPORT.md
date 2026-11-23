# SokhaPheap: Verification Report

These are the results of running `SokhaPheap_Verification_Checklist.md`, started on 23 Nov 2026 against commit `bd01aae`. Secret values are never printed; matches were shortened or masked.

- **LOCAL:** `C:\Users\ASUS PC\Desktop\Hackathon Open Data`
- **PROD:** https://sokhapheap-6c0l.onrender.com

## Section A: Repo hygiene and secrets

| ID | Status | Evidence | Notes |
|---|---|---|---|
| A1 | PASS | `git check-ignore .env.local` → ignored. `git log --all --full-history -- .env.local` → 0 commits. I ran the same checks on `.env`, the file that actually holds your keys: ignored, 0 commits. | Your secrets are in `.env`, not `.env.local`. Both are ignored. |
| A2 | PASS | `git grep` over the tree and `git log --all -p -G` over history for `sb_secret_`, `sk-ant-`, `AIza`, `AQ.`, `postgresql://`, the Telegram token pattern, `eyJhbGciOi` (JWT) and hex strings of 40+ characters. Only 3 hits: (1) `.env.example:5`, which is the example `postgresql://postgres.<ref>:<password>@…` placeholder; (2) the same placeholder in an old version of `REVIEW.md`; (3) `scripts/check_bundle_secrets.ts:22`, which is the list of prefixes the scanner searches for (`"AIza"`, `"sb_secret_"`). No real values. | `package-lock.json` was excluded, because its integrity hashes match the hex pattern. |
| A3 | PASS | The 12 variables read via `process.env` in `src/`, `scripts/` and `next.config.ts` exactly match the keys in `.env.example`. Nothing is missing and nothing is unused. | Three keys have **non-secret defaults** rather than empty values: `AI_MODEL=gemini-3.8-flash`, `AI_MODEL_FAST=gemini-3.5-flash-lite` and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. All secret keys are empty. **Decision (you, 23 Nov):** keep these defaults. |
| A4 | PASS | `render.yaml`: all 11 runtime variables use `sync: false` with no value. The only literal values are `NODE_VERSION: "24"` and `NEXT_TELEMETRY_DISABLED: "1"`, which are not secrets. | `SUPABASE_DB_URL` is intentionally absent. It's used only by `scripts/db_migrate.ts` and `scripts/check_bundle_secrets.ts`, not at runtime. |
| A5 | PASS | No `"use client"` file reads any non-`NEXT_PUBLIC_` env var. The secret-using libs (`lib/ai/gemini.ts`, `lib/bot/bot.ts`, `lib/db/supabase.ts`) import `server-only`; the other secret users are API route handlers (server-only by design). `npm run check:secrets` on a **fresh** build (`.next` deleted and rebuilt) found none of the real values of the 7 server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `ORG_DASHBOARD_ACCESS_CODE`) and none of the prefixes `AIza`, `sb_secret_` or `service_role`, across 26 client files. | |
| A6 | PASS | `npm audit --omit=dev` (the current form of `--production`) → `{"info":0,"low":0,"moderate":0,"high":0,"critical":0}`. `npm ci` also reported 0 vulnerabilities, including dev dependencies. | |
| A7 | PASS | `README.md` (90 lines) lists all 4 open data sources (MoH 2010 facilities, OSM/HOT facilities, admin boundaries and the WHO HEARTS chart, p. 65), with licences, and links to `data/SOURCES.md`. Architecture, commands, deploy steps and limitations match the code. | `data/SOURCES.md` lists the 3 datasets; the WHO chart source is in code and `REVIEW.md`. It is checked again under C9/D5. |

## Section B: Build and automated tests

| ID | Status | Evidence | Notes |
|---|---|---|---|
| B1 | PASS | `npm ci` → "added 500 packages, and audited 501 packages in 1m … found 0 vulnerabilities", exit 0. | |
| B2 | PASS | Ran `npm run build` after deleting `.next`: exit 0, "✓ Compiled successfully in 16.0s", "Finished TypeScript in 6.7s", 26/26 static pages, and no errors or warnings in the log. `npx tsc --noEmit` also exited 0, so there are no type errors in the tests and scripts either. | |
| B3 | PASS | `npm run lint` (eslint) → exit 0, no warnings. | |
| B4 | PASS | `npm test` → **Test Files 9 passed (9), Tests 82 passed (82)**. | |
| B5 | PASS | `npm run test:coverage` (v8, `src/lib/scoring/**`): **statements 98.72% (155/157), branches 95.6% (174/182), functions 100%, lines 98.24%**. By file: `findrisc.ts` 98.14%; `labRanges.ts` 98.21%; `whoCvd.ts` and `whoCvdTable.ts` 100%. | The text table hides fully covered files, so the per-file figures come from the JSON summary. |

**Summary so far:** A: 7 PASS. B: 5 PASS. No fixes were needed.
