# Demo Day script (3 minutes)

## 5 minutes before going on stage (warm-up)

The free Render service sleeps after 15 minutes without traffic.

1. On the demo phone, open `https://<app>.onrender.com/km` and wait until it loads. That wakes the server.
2. Open `/api/health` and confirm it shows `"ok": true`.
3. In Telegram, send `/start` to **@SokhaPheapBot** and wait for the welcome reply.
4. Open the map once (`/km/map`, then tap **បង្ហាញផែនទី**) so the map tiles are cached.
5. Turn screen brightness up, turn on Do Not Disturb, and keep a phone charger nearby.

## Live path

| Time | Screen | What to do / say |
|---|---|---|
| 0:00 | Home `/km` | "Cambodia has a growing burden of diabetes and heart disease, and many people find out late. SokhaPheap is a free check in Khmer that ends with where to go next." |
| 0:15 | Tap **ពិនិត្យហានិភ័យរបស់ខ្ញុំ** | Briefly show the **safety screen** ("chest pain? → go to hospital now"), then tap **គ្មានទាំងអស់**. |
| 0:25 | Open `/km/risk?demo=1` (bookmark it) | Demo mode pre-fills the answers. Tap **បន្ទាប់** through the 13 questions, about 1 second each, and point out the waist-with-a-string tip. |
| 1:00 | **Results** | **High diabetes risk (15/26)**, **heart risk 10–<20%**, top factors (waist, family, age), next step: see a doctor in the next few weeks. Point at the disclaimer. "Scores are calculated by validated rules, not AI. AI only explains them in simple Khmer." |
| 1:30 | Tap **ស្វែងរកកន្លែងព្យាបាលនៅជិតខ្ញុំ** | Use location, or choose **Phnom Penh** if location is blocked. Show the nearest 5, tap **បង្ហាញផែនទី** to show them on the map, then tap **Directions**. "1,440 facilities from Ministry of Health and OpenStreetMap open data, cleaned and merged." |
| 2:00 | `/km/lab` | Upload `tests/fixtures/lab_reports/02_en_high_glucose.png` (keep it in the phone's photos). Show the confirm screen, tap **ពិនិត្យលទ្ធផលរបស់ខ្ញុំ**, and show glucose and HbA1c flagged as outside the range, with the Khmer explanation. |
| 2:30 | Telegram | Show the same check in **@SokhaPheapBot**: `/check`, one or two buttons, then "the same scoring engine works for people who live in Telegram." |
| 2:45 | `/km/org/DEMO` | Enter the access code and show anonymous totals for an employer, with groups under 5 people hidden. Labelled **Demo data**. |
| 3:00 | Close | "Free, Khmer-first, built on Cambodian open data, and safe by design. Next step: pilot with a factory clinic and validate locally." |

**Exact demo inputs** (pre-filled by `?demo=1`): man, 58 years, 165 cm, 78 kg, waist 98 cm, not active, no daily vegetables, has taken BP medicine, no past high glucose, grandparent/aunt/uncle/cousin with diabetes, smoker, SBP 150, Phnom Penh.
Expected result: FINDRISC **15 → High**, WHO CVD **13% → 10–<20%**, next step **see a doctor soon**. Demo mode saves nothing.

## Backup plan if the network fails

1. **Phone hotspot:** keep mobile data on a second phone and switch to it.
2. **Offline video:** record a 90-second screen recording of the path above the day before (`demo_backup.mp4` in the phone's gallery).
3. **Screenshots:** keep the results, map and lab screens in a phone album.
4. **Laptop fallback:** run `npx next start -p 3100` locally. Scoring, the map list and template explanations all work without AI or the database; only the map tiles need the internet.
5. If AI is slow, explanations switch to the standard template text automatically. Say "this is the offline explanation" and move on.
