# Khmer review list: UI redesign (24 Nov 2026)

TODO(KM-REVIEW): every Khmer string below was written by Claude for the redesign and **has not been checked by a native speaker**. JSON files can't hold comments, so they are listed here. Edit `km.json` directly; key paths are given.

## Least sure (please check first)
| Key | Khmer | English meaning | Why unsure |
|---|---|---|---|
| `check.draftBanner` | កំណែដំបូង៖ ការពិនិត្យទាំងនេះធ្វើតាមគោលការណ៍ណែនាំរបស់ WHO … ប៉ុន្តែវេជ្ជបណ្ឌិតមិនទាន់បានពិនិត្យនៅឡើយទេ … | Early version: … a doctor has not reviewed them yet … | **Safety wording on the public health check: please check first** |
| `landing.heroCheck.*` | ពិនិត្យបេះដូង សម្ពាធឈាម ទឹកនោមផ្អែម តម្រងនោម និងរបេង ក្នុងពេលតែមួយ … | Check your heart, blood pressure, diabetes, kidneys and TB in one go | First thing visitors read |
| `landing.cta.bodyCheck` | … សំណួរមួយឈុតគ្របដណ្តប់ការពិនិត្យជាច្រើន។ | One set of questions covers several screenings | |
| `risk.bpMeds.info` | ថ្នាំសម្ពាធឈាម គឺជាថ្នាំពីវេជ្ជបណ្ឌិត … ឧទាហរណ៍ … amlodipine, telmisartan, hydrochlorothiazide និង chlorthalidone … | What blood pressure medicine is (examples from the WHO 2021 guideline, PDF page 40) | **Medical explanation: please check first** |
| `risk.waist.unit` / `risk.waist.help` / `bot.typeWaist` | អ៊ីញ / … ទំហំចង្កេះខោរបស់អ្នកជាអ៊ីញ … | Waist now asked in inches | Is «អ៊ីញ» the word people use for trouser size? |
| `bot.menuHealth`, `bot.hcIntro`, `bot.hcChoose`, `bot.hcContinue`, `bot.hcNoneSelected`, `bot.hcUseButtons`, `bot.typeDbp`, `bot.typeNumber` | ការពិនិត្យសុខភាពរបស់ខ្ញុំ (៦ ប្រភេទ) … | Telegram health check | New bot conversation |
| `bot.welcome`, `bot.help` | … /health … | Updated: health check added, /near removed from help | |
| `bot.urgentContinue`, `bot.backToMenu` | ខ្ញុំមានសុវត្ថិភាព បន្តការពិនិត្យ / ត្រឡប់ទៅម៉ឺនុយ | I am safe, continue the check / Back to the menu | Buttons on the bot's "go to hospital" message |
| `landing.examples.*` | លទ្ធផលឧទាហរណ៍ · ដារ៉ា អាយុ ៤៥ ឆ្នាំ … / លទ្ធផលមន្ទីរពិសោធន៍ឧទាហរណ៍ / ចម្ងាយទៅមណ្ឌលសុខភាពជិតបំផុត … | Hero example cards (result, lab report, distance chart) | Includes «ដារ៉ា» for "Dara" and «គ.ម» for km |
| Team roles (`src/lib/team.ts`) | អ្នកដឹកនាំផលិតផល និងបទបង្ហាញ / អ្នកអភិវឌ្ឍកម្មវិធី Full-Stack / អ្នកស្រាវជ្រាវ និងវិភាគទិន្នន័យ / ស្រាវជ្រាវអ្នកប្រើប្រាស់ និងការបកប្រែភាសា | Product & Pitch Lead / Full-Stack Developer / Research & Data Analyst / User Research & Localization | Job titles: please check they read naturally |
| `common.whatIsThis` | តើនេះមានន័យថាអ្វី? | What does this mean? | |
| `nav.cta` | សាកល្បងឥឡូវនេះ | Try it now | Natural for a button? Maybe «ចាប់ផ្តើម» is better |
| `nav.theme` | ពន្លឺ ឬងងឹត | Light or dark | Wording for a theme switch |
| `nav.toDark` / `nav.toLight` | ប្តូរទៅពណ៌ងងឹត / ប្តូរទៅពណ៌ភ្លឺ | Switch to dark / light theme | Screen-reader labels |
| `nav.main` | ម៉ឺនុយមេ | Main (menu) | Screen-reader label |
| `landing.problem.title` | បញ្ហាសុខភាពជាច្រើននៅកម្ពុជា ត្រូវបានរកឃើញយឺតពេល | Many health problems in Cambodia are found too late | Tone |
| `landing.problem.stats.outOfPocket` | នៃការចំណាយលើសុខភាព ត្រូវបង់ពីហោប៉ៅខ្លួនឯង | of health spending is paid out of pocket | Idiom «ពីហោប៉ៅខ្លួនឯង» |
| `landing.solution.title` | {app} នាំការពិនិត្យសុខភាពដំបូង មកដល់ទូរសព្ទគ្រប់គ្នា | {app} brings early screening to every phone | «ការពិនិត្យសុខភាពដំបូង» for "early screening" |
| `landing.impact.eyebrow` | ផ្អែកលើទិន្នន័យបើកចំហ | Built on open data | |
| `landing.impact.provinces` | ខេត្ត-រាជធានី | provinces covered | Shortened |
| `landing.carousel.*` | ស្លាយមុន / ស្លាយបន្ទាប់ / ផ្អាកការបង្ហាញស្លាយ … | Carousel controls | Loanword «ស្លាយ» |
| `footer.dataNote` | … ការអង្កេតប្រជាសាស្ត្រ និងសុខភាពកម្ពុជា ២០២១–២២ | Cambodia DHS 2021–22 | Official Khmer name of the DHS |

## All other new keys (lower risk, still unreviewed)
- `nav.*`: home, check, lab, map, insights, about, openMenu, closeMenu, skip, language
- `landing.hero[0–3]`: eyebrow, title, desc, cta
- `landing.problem`: eyebrow, body, stats.diagnosed, stats.controlled
- `landing.solution`: eyebrow, points[0–3]
- `landing.features`: eyebrow, title, open
- `landing.how`: eyebrow, title, steps[0–3]
- `landing.impact`: title, body, facilities, communes, datasets
- `landing.team`, `landing.cta`
- `footer`: product, data, settings, allSources, credit
- `src/lib/team.ts`: placeholder names, roles and bios (to be replaced with the real team anyway)
- `lab.dragHint`, `lab.dropHere`, `lab.unsupportedFile` (drag-and-drop upload, 25 Nov 2026): «ឬអូសរូបថត ឬឯកសារ PDF … មកទីនេះ» / «ទម្លាក់លទ្ធផលរបស់អ្នកនៅទីនេះ». Are «អូស» (drag) and «ទម្លាក់» (drop) the words people use?

## How to check
Run the app (`npm run dev`) and open `http://localhost:3000/km`. Go through the home page, the menu (narrow the window or use a phone) and the footer, in light and dark.
