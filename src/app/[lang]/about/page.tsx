import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { Disclaimer } from "@/components/Disclaimer";

const DATASETS = [
  {
    name: "Cambodia – Health Facilities (referral hospitals, health centres, health posts), 2010",
    publisher: "Ministry of Health, Cambodia — via HDX",
    url: "https://data.humdata.org/dataset/cambodia-health",
    licence: "See dataset page (HDX: Other)",
  },
  {
    name: "Health Facilities of Cambodia (OpenStreetMap export)",
    publisher: "Humanitarian OpenStreetMap Team — © OpenStreetMap contributors, via HDX",
    url: "https://data.humdata.org/m/dataset/hotosm_khm_health_facilities",
    licence: "ODbL 1.0",
  },
  {
    name: "Cambodia – Subnational Administrative Boundaries",
    publisher: "Ministry of Land Management, Urbanization and Construction / WFP — via HDX",
    url: "https://data.humdata.org/dataset/cod-ab-khm",
    licence: "CC BY-IGO",
  },
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
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold">{t.dataTitle}</h2>
        <ul className="mt-2 flex flex-col gap-3">
          {DATASETS.map((d) => (
            <li key={d.url} className="rounded-xl bg-surface p-3 shadow-sm" lang="en">
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
        <h2 className="text-lg font-bold">{t.privacyTitle}</h2>
        <p className="mt-1">{t.privacy}</p>
      </section>
    </article>
  );
}
