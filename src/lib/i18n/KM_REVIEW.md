# Khmer review list: UI redesign (24 Nov 2026)

TODO(KM-REVIEW): every Khmer string below was written by Claude for the redesign and **has not been checked by a native speaker**. JSON files can't hold comments, so they are listed here. Edit `km.json` directly; key paths are given.

## Least sure (please check first)
| Key | Khmer | English meaning | Why unsure |
|---|---|---|---|
| `check.draftBanner` | កំណែដំបូង៖ ការពិនិត្យទាំងនេះធ្វើតាមគោលការណ៍ណែនាំរបស់ WHO … ប៉ុន្តែវេជ្ជបណ្ឌិតមិនទាន់បានពិនិត្យនៅឡើយទេ … | Early version: … a doctor has not reviewed them yet … | **Safety wording on the public health check: please check first** |
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

## How to check
Run the app (`npm run dev`) and open `http://localhost:3000/km`. Go through the home page, the menu (narrow the window or use a phone) and the footer, in light and dark.
