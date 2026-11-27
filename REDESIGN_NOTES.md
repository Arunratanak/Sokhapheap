# Redesign notes

Visual redesign following `DESIGN.md`. Nothing about how the app works was changed: same routes, API calls,
scoring, AI prompts, form fields and i18n keys (new keys were only added).

**Owner decisions (27 Nov 2026)**
- The logo (orange heart with a pulse line, `src/components/ui/Logo.tsx`, `src/app/icon.svg`) stays exactly as it is,
  even though DESIGN.md §2 lists heart-with-heartbeat graphics. It is the brand mark, not a decoration.
- The public home page is restyled in place (every section and link kept), not cut down.

## 1. Audit (before)

### Screens
| Route | Purpose | Main components |
|---|---|---|
| `/[lang]` | Public landing page | `HeroCarousel`, `HeroVisual`, `Section`, `Card`, `StatCounter`, `TeamGrid` |
| `/[lang]/check` | Multi-screening health check (profile → choose → questions → results dashboard) | `CheckFlow` |
| `/[lang]/risk` | Diabetes + heart risk questionnaire and results | `RiskFlow`, `ResultsView`, `AreaCard` |
| `/[lang]/lab` | Lab report upload → review values → results (+ AI explanation) | `LabFlow` |
| `/[lang]/map` | Find care: nearest facilities, list + optional map | `MapExplorer`, `FacilityList`, `FacilityMap` |
| `/[lang]/insights` (+ `/api`) | Open-data explorer: national cards, choropleth, ranking, downloads | `InsightsExplorer`, `ChoroplethMap` |
| `/[lang]/about` | About, privacy, method, limits, data sources, team | `InfoCard`, `TeamGrid` |
| `/[lang]/account` | Log in with Telegram, saved records | `TelegramLogin`, `RecordsView`, `SaveRecordButton` |
| `/[lang]/org/[code]`, `/[lang]/plan/[province]` | Organisation dashboard, printable screening plan | `OrgDashboard`, `ScreeningPlanner` |
| Shared | Header, footer, theme, language | `Navbar`, `Footer`, `ThemeToggle`, `LanguageSwitcher`, `LoadingState`, `Disclaimer`, `InfoTip`, `BrandIcons` |

There is no vitals tracking, trend chart or bottom navigation in this app, so DESIGN.md §9.4 and the bottom-nav rules don't apply.

### Patterns from DESIGN.md §2 found
**Generic AI look**
- Orange→gold gradients everywhere: `--gradient` on buttons (`btn-gradient`), the home CTA panel, step numbers,
  team avatars, bullets, chart bars, card hover borders; gradient text (`text-gradient`) on home stats.
- Blurred glow blobs (`blur-3xl`, `blur-2xl`) behind the home hero, hero visual, solution card, welcome card, team photos.
- `backdrop-blur` on the top navbar, the mobile menu scrim and hero chips.
- Dotted background pattern on the hero and the CTA panel.
- Custom duotone icon set (`BrandIcons.tsx`) instead of Lucide; a heart-with-pulse icon for "heart risk".
- Emojis in UI chrome: 60+ in components (status dots 🟢🟠🔴, 👉, 📍, 🗺️, ⬇️, 🖨️, 🔒, ⚠️ in the disclaimer, 👨/👩 on the sex choice,
  🚨/🚑/📞 on the urgent screens, facility-type emojis 🏥➕⛑️🩺, ℹ️ in notes). Locale files: emojis only in Telegram bot
  messages (`bot.*`), which are not website UI and were left unchanged.
- Light theme default with a warm-white "template" look; dark only when the system asks for it.

**Clutter**
- Several gold/orange primary buttons on one screen (e.g. lab results: Find care + Save; risk results: AreaCard's Show + Find care; GoNow).
- Home: hero + 3 stat cards + solution card above the fold on desktop; count-up animation on health statistics.
- Redundant icons next to every label; decorative timeline gradient line on "How it works".

**Inconsistency**
- Radii mixed: `rounded`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-[1rem]`, `rounded-[1.1rem]`, `rounded-[1.25rem]`, `rounded-[2.5rem]`.
- Arbitrary values: `text-[10px]`, `text-[11px]`, `text-[#1c1917]`, `bg-[#1c1917]`, `text-[var(--danger)]` ×10, `bg-[var(--danger-solid)]`.
- Font sizes off any scale: `text-3xl`…`text-6xl`, `text-[10px]`.
- Hard-coded hex colours in components: facility types, org bar colours, plan map, logo-coloured loading.
- Two fonts plus a bigger Khmer root size (106.25%) instead of per-size Khmer rules.

**Alarming UX**
- Urgent screen: solid red panel with white text (`--danger-solid`), "🚨" uppercase red label, red-tinted buttons.
- Status shown as large coloured blocks (whole result sections filled red/orange); colour + emoji dot, no Lucide status icon.
- Loading: beating logo + bouncing dots (looping animation).

## 2. What changed

### Tokens and theme (`src/app/globals.css`, `src/app/[lang]/layout.tsx`, `ThemeToggle.tsx`)
- DESIGN.md §3 colour tokens (dark default, cream light theme), §3.3 muted status palette with `-subtle` tints, §4.2 type
  scale, §5.3 radius scale, §5.4 elevation (no shadows in dark, one soft shadow in light).
- Existing semantic utility names (`bg-surface`, `text-muted`, `border-line`, `bg-brand`, `text-brand-strong`, …) now point
  at the new tokens, so every screen picks them up; new names added (`bg-surface-3`, `text-tertiary`, `border-strong`,
  `text-gold`, `text-status-*`, `bg-status-*-subtle`).
- Tailwind's size and radius scales were remapped so only allowed values exist: `text-xs` 12, `text-sm` 14, `text-base` 16,
  `text-lg` 18, `text-xl` 22, `text-2xl`/`3xl` 28, `text-4xl`+ 40; `rounded-lg` 8, `rounded-xl` 12, `rounded-2xl` 16,
  `rounded-3xl` 24 (anything smaller snaps to 8). Named aliases: `text-display`, `text-h1`, `text-h2`, `text-h3`,
  `text-body`, `text-label`, `text-caption`, `text-micro`.
- Khmer: line-height × 1.25 and +1 px on sizes ≤ 14 px (instead of scaling the whole page), letter-spacing 0, no uppercase.
- Fonts: Inter + Kantumruy Pro (Noto Sans Khmer removed).
- Dark is the default; a saved choice still wins and is applied before first paint.

### Shared components
- Buttons: gold primary (48 px, `radius-md`), outlined secondary, quiet ghost, destructive ghost; 2 px gold focus ring.
  `btn-gradient` now renders as the plain primary button.
- Cards: `surface-1`, 1 px border, `radius-lg`, 20 px padding; no hover lift, glow or gradient border.
- Inputs (`.field`): 48 px, `surface-2`, `border-strong`, 16 px text.
- New: `StatusChip` (colour + Lucide icon + label), `RangeBar` (lab value against its reference range), `AiCard`
  (gold-muted left border, "AI" mark), `Skeleton`.
- `LoadingState`: skeleton lines + the existing message (no beating logo, no bouncing dots).
- `Disclaimer`: neutral caption with an info icon (no warning emoji / yellow box).
- `BrandIcons`: same exports, now drawn with Lucide icons (stroke 1.5).
- `Navbar`: solid surface, no blur; gold active tab; one gold button. Mobile menu scrim per §5.4.
- `StatCounter`: shows the final number (no count-up on health statistics).
- Motion: 150/200/300 ms with the DESIGN.md easing; slides ≤ 12 px; no looping animations.

### Screens
See the per-screen list in section 3.

## 3. Per screen

| Screen | Removed | Restyled |
|---|---|---|
| Home | Glow blobs, dotted pattern, gradient CTA panel, gradient step numbers and timeline line, gradient text, count-up, hover lifts, custom icons | Hero, feature cards, stats, steps, team, CTA as quiet cards; one gold button per view |
| Lab results | Emoji flags, coloured result blocks | Neutral rows: name, value + unit, status chip, range bar; sorted out of range → unclear → in range for display; AI card |
| Lab upload / review | Emojis on buttons | Lucide `camera` / `keyboard` buttons, uncertain rows marked with borderline border + icon, one gold confirm |
| Health check results | Emoji dots, coloured badge blocks | Neutral cards with status chips; urgent cards pinned style (left border + phone icon) |
| Risk results | Coloured section fills, emoji | Neutral cards + status chip + level meter in status colour; AI card |
| Risk urgent screens | Solid red panel, emojis, red buttons | Neutral card with `--status-out` left border and phone icon; neutral option rows |
| Map | Facility emojis, blue user dot | Lucide icons, muted type colours, secondary directions button, gold "you are here" dot |
| Insights / API | Emojis, filled brand-soft blocks | Token cards, segmented control, calmer choropleth palette (gold-brown sequential) |
| About | Custom icons, gradient bullets | Lucide icons, plain bullets |
| Account | Emoji status icons | Status chips |
| Org / plan | Emojis, hard-coded bar colours | Token colours (print stays light) |

## 4. DESIGN-TODO (needs a functional change; for the owner)
- **Range bars in saved records** (`RecordsView`): records don't store the reference range (`src/domain/records.ts`), so
  saved lab values show a status chip only. Storing the range would change the record format.
- **Telegram bot messages** use emojis (`bot.*` strings, `src/server/bot/*`). That's the Telegram chat, not the website;
  left unchanged.
- **"In range" collapse** (§8.1.3): lab reports usually have fewer than 10 values, so in-range results are listed (sorted
  last) rather than collapsed behind a toggle.
- **PWA manifest** (§13): the app has no web manifest; nothing to update. The browser theme colour was set to `#0E0D0B`.
- **Khmer status labels** from DESIGN.md §3.3 were not substituted: the existing reviewed strings are kept (DESIGN.md allows this).

## 5. Deliberate deviations (and why)
- **Range-bar zone** uses the normal-status colour at 30 % instead of the 10 % `-subtle` tint: at 10 % the zone was invisible on
  the `surface-3` track in the dark theme.
- **`--text-tertiary`** (from DESIGN.md) is below AA for body text in both themes (~3.5:1), so it is used only for decorative
  icons (empty-state icon) and placeholders; timestamps, units and axis labels use `--text-secondary` instead.
- **Hex colours that remain in components**: Leaflet map markers and choropleth outlines (`FacilityList.tsx`, `FacilityMap.tsx`,
  `ChoroplethMap.tsx`) and the plan's SVG map draw on a canvas/SVG where CSS variables can't be used; the link-preview image
  (`opengraph-image.tsx`) is rendered on the server. All use DESIGN.md token values or a muted categorical set kept in one place.
- **Print-only sizes** (`text-[10pt]`, `text-[7.5pt]` on the printable A4 plan) and **viewport heights** for maps (`h-[55vh]`)
  are kept; they are print/layout dimensions, not type or spacing tokens.
- **Header "Try it now"** button is secondary (outlined) so each page keeps one gold button; it's gold only inside the mobile menu.
- **Home page** has a gold button in the hero and in the closing card; they are never on screen together.
- **The logo** (`Logo.tsx`, `icon.svg`) is untouched, as decided by the owner.

## 6. Verification (27 Nov 2026)
- `tsc`, ESLint: clean. Unit + integration tests: 275/275 pass.
- Production build: passes; `/dev/design` returns 404 in production and is removed from the GitHub Pages build.
- E2E (production server): `risk-ui` 10/10, `a11y` 0 axe violations on 10 pages (incl. colour contrast), `map-3g`, `check-bp`,
  `insights`, `ui-themes` (8 pages × dark/light × en/km × 360/768/1024/1440 px: no overflow, no console errors).
- Lab results, risk results, urgent screens walked through in en/dark/390 px and km/light/360 px: no overflow, no console errors.
- Pre-existing E2E failures, **identical on the commit before the redesign** (checked by building it): `check-tb`, `check-egfr`,
  `check-cvd-lab` (wait for a heading text that no longer exists), `demo` (same timeout), `planner` (Khmer plan prints on 2 pages),
  `consistency` (imports a server-only module).
