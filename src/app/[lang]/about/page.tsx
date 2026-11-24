import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { fmt, getDictionary, hasLocale } from "@/lib/i18n";
import { TeamGrid } from "@/components/home/TeamGrid";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { Disclaimer } from "@/components/Disclaimer";
import { IconCaution, IconLayers, IconPathSteps, IconPeople, IconShieldLock, IconSignpost } from "@/components/ui/BrandIcons";
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

/** Section card: brand icon tile + heading + content. */
function InfoCard({ icon: Icon, title, id, children, className = "" }: { icon: React.ComponentType<{ size?: number }>; title: string; id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`card flex flex-col gap-4 p-6 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-surface-2 text-brand-strong ring-1 ring-line">
          <Icon size={28} />
        </span>
        <h2 id={id ? `${id}-title` : undefined} className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5 text-sm leading-relaxed">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full [background:var(--gradient)]" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.about;
  const landing = dict.landing;
  const DATASETS = [
    ...manifest().map((m) => ({ name: m.name, publisher: m.publisher, url: m.url, licence: `${m.licence} · ${m.data_year}` })),
    ...EXTRA_DATASETS,
  ];

  return (
    // page-wide: uses the full desktop width (72rem); one column on phones, two on tablets.
    <article className="page-wide flex flex-col gap-8 pt-4 lg:gap-10">
      {/* Intro + privacy */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <header className="flex flex-col gap-4">
          <p className="eyebrow">{dict.nav.about}</p>
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{t.title}</h1>
          <p className="max-w-3xl text-lg text-muted">{t.body}</p>
          <Disclaimer text={dict.common.disclaimer} />
        </header>
        <InfoCard icon={IconShieldLock} title={t.privacyTitle} id="privacy">
          <p className="text-sm leading-relaxed">{t.privacy}</p>
        </InfoCard>
      </div>

      {/* How it works · Limitations · Roadmap */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <InfoCard icon={IconPathSteps} title={t.howTitle} id="how">
          <Bullets
            items={[
              t.how1,
              t.how2,
              t.how3,
              <>
                {t.how4}{" "}
                <Link href={`/${lang}/insights`} className="font-semibold text-brand-strong underline underline-offset-4">{t.insightsLink}</Link>
              </>,
            ]}
          />
        </InfoCard>
        <InfoCard icon={IconCaution} title={t.limitsTitle} id="limits">
          <Bullets items={[t.limit1, t.limit2, t.limit3]} />
        </InfoCard>
        <InfoCard icon={IconSignpost} title={t.roadmapTitle} id="roadmap" className="md:col-span-2 lg:col-span-1">
          <Bullets items={[t.roadmap1, t.roadmap2, t.roadmap3, t.roadmap4]} />
        </InfoCard>
      </div>

      {/* Data sources */}
      <section id="data" aria-labelledby="data-title" className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-surface-2 text-brand-strong ring-1 ring-line">
            <IconLayers size={28} />
          </span>
          <h2 id="data-title" className="text-2xl font-bold">{t.dataTitle}</h2>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DATASETS.map((d) => (
            <li key={d.name} lang="en" className="card flex flex-col gap-2 p-5">
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1 font-semibold leading-snug text-brand-strong hover:underline">
                <span>{d.name}</span>
                <ArrowUpRight aria-hidden size={16} className="mt-0.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
              <p className="mt-auto text-sm text-muted">{d.publisher}</p>
              <p className="text-xs text-muted">{d.licence}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Team */}
      <section id="team" aria-labelledby="team-title" className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-surface-2 text-brand-strong ring-1 ring-line">
            <IconPeople size={28} />
          </span>
          <div>
            <h2 id="team-title" className="text-2xl font-bold">{fmt(landing.team.title, { app: dict.common.appName })}</h2>
            <p className="text-muted">{landing.team.body}</p>
          </div>
        </div>
        <MotionProvider>
          <TeamGrid lang={lang} />
        </MotionProvider>
      </section>
    </article>
  );
}
