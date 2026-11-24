import { notFound } from "next/navigation";
import { fmt, getDictionary, hasLocale } from "@/lib/i18n";
import Link from "next/link";
import { TeamGrid } from "@/components/home/TeamGrid";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { Disclaimer } from "@/components/Disclaimer";
import { manifest } from "@/lib/insights/data";

/** Datasets used outside the open-data pipeline (the pipeline ones come from data/manifest.json). */
const EXTRA_DATASETS = [
  {
    name: "WHO CVD risk non-laboratory-based chart — South-East Asia (HEARTS technical package, 2020)",
    publisher: "World Health Organization",
    url: "https://www.who.int/publications/i/item/9789240001367",
    licence: "CC BY-NC-SA 3.0 IGO",
  },
  {
    name: "Map tiles",
    publisher: "© OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/copyright",
    licence: "ODbL 1.0",
  },
];

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang).about;
  const disclaimer = getDictionary(lang).common.disclaimer;
  const landing = getDictionary(lang).landing;
  const DATASETS = [
    ...manifest().map((m) => ({ name: m.name, publisher: m.publisher, url: m.url, licence: `${m.licence} · ${m.data_year}` })),
    ...EXTRA_DATASETS,
  ];

  return (
    <article className="flex flex-col gap-5 pt-2">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p>{t.body}</p>
      <Disclaimer text={disclaimer} />

      <section>
        <h2 className="text-lg font-bold">{t.howTitle}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t.how1}</li>
          <li>{t.how2}</li>
          <li>{t.how3}</li>
          <li>{t.how4} <Link href={`/${lang}/insights`} className="underline underline-offset-4">{t.insightsLink}</Link></li>
        </ul>
      </section>

      <section id="data">
        <h2 className="text-lg font-bold">{t.dataTitle}</h2>
        <ul className="mt-2 flex flex-col gap-3">
          {DATASETS.map((d) => (
            <li key={d.name} className="rounded-xl bg-surface p-3 shadow-sm" lang="en">
              <a href={d.url} className="font-semibold text-brand-strong underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                {d.name}
              </a>
              <p className="text-sm text-muted">{d.publisher} · {d.licence}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold">{t.limitsTitle}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t.limit1}</li>
          <li>{t.limit2}</li>
          <li>{t.limit3}</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold">{t.roadmapTitle}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t.roadmap1}</li>
          <li>{t.roadmap2}</li>
          <li>{t.roadmap3}</li>
          <li>{t.roadmap4}</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold">{t.privacyTitle}</h2>
        <p className="mt-1">{t.privacy}</p>
      </section>

      <section id="team" aria-labelledby="team-title" className="mt-4">
        <p className="eyebrow">{landing.team.eyebrow}</p>
        <h2 id="team-title" className="mt-2 text-2xl font-bold">{fmt(landing.team.title, { app: getDictionary(lang).common.appName })}</h2>
        <p className="mt-1 mb-5 text-muted">{landing.team.body}</p>
        <MotionProvider>
          <TeamGrid lang={lang} compact />
        </MotionProvider>
      </section>
    </article>
  );
}
