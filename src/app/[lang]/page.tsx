import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CircleCheck, Lock } from "lucide-react";
import { fmt, formatNumber, getDictionary, hasLocale } from "@/i18n";
import { visibleModules } from "@/domain/modules/registry";
import { homeStats } from "@/server/insights/data";
import { HeroCarousel, type HeroSlide } from "@/components/features/home/HeroCarousel";
import { TeamGrid } from "@/components/features/home/TeamGrid";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Reveal, RevealItem } from "@/components/ui/Reveal";
import { StatCounter } from "@/components/ui/StatCounter";
import { formatCount } from "@/lib/format";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { IconHealthCheck, IconHeartRisk, IconLabTube, IconTempleData } from "@/components/ui/BrandIcons";
import type { HeroVisualData, Tone } from "@/components/features/home/HeroVisual";
import { distanceExample, labExample, riskExample } from "@/server/data/heroExamples";

const SOURCE_LABEL: Record<string, string> = {
  "who-gho": "WHO",
  "world-bank-health": "World Bank",
};

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const L = t.landing;
  const app = t.common.appName;
  const stats = homeStats();
  // The multi-screening health check is listed only once a module is clinician-verified.
  const healthCheckLive = visibleModules(false).length > 0;
  const base = `/${lang}`;
  const n = (v: number) => formatCount(v, lang);

  // Example cards: values computed with the real scoring / lab / open-data logic (src/server/data/heroExamples.ts).
  const X = L.examples;
  const num = (v: number) => formatNumber(v, lang);
  const risk = riskExample();
  const tone = (u: string) => (u === "low" ? "ok" : u === "moderate" ? "caution" : "danger") as Tone;
  const riskVisual: HeroVisualData = {
    kind: "risk",
    title: X.risk.title,
    subtitle: fmt(X.risk.subtitle, { n: num(risk.screenings) }),
    percent: risk.heartPercent,
    percentText: `${num(risk.heartPercent)}%`,
    caption: X.risk.heartCaption,
    band: X.risk.low,
    tiles: [
      { tone: tone(risk.diabetes.urgency), icon: "diabetes", label: X.risk.diabetes, status: X.risk.diabetesStatus },
      { tone: tone(risk.bp.urgency), icon: "bp", label: X.risk.bp, value: `${num(risk.bp.sbp)}/${num(risk.bp.dbp)}`, status: X.risk.bpStatus, next: X.risk.bpNext },
      { tone: tone(risk.tb.urgency), icon: "tb", label: X.risk.tb, value: X.risk.tbValue, status: X.risk.tbStatus, next: X.risk.tbNext },
    ],
    next: { text: fmt(X.risk.next, { km: num(risk.nearestHealthCentreKm ?? 0) }), href: `${base}/map?type=health_centre` },
  };
  const lab = labExample();
  const labVisual: HeroVisualData = {
    kind: "lab",
    title: X.lab.title,
    subtitle: fmt(X.lab.subtitle, { n: num(lab.length) }),
    rows: lab.map((r) => ({
      tone: r.flag === "normal" ? "ok" : "caution",
      name: X.lab[r.key].name,
      value: `${r.value} ${r.unit}`,
      note: X.lab[r.key].note,
      pill: t.lab.flags[r.flag],
    })),
  };
  const dist = distanceExample();
  const dataVisual: HeroVisualData = {
    kind: "data",
    title: X.data.title,
    subtitle: fmt(X.data.subtitle, { province: dist.province }),
    highlight: fmt(X.data.highlight, { district: dist.top.name, km: num(dist.top.km) }),
    chartLabel: fmt(X.data.chartLabel, { province: dist.province, district: dist.top.name, km: num(dist.top.km) }),
    bars: dist.bars.map((b) => ({ name: b.name, label: b.name.split(" ")[0], km: b.km, kmText: `${num(b.km)} km`, top: b.name === dist.top.name })),
    stats: [
      { value: formatCount(dist.communes, lang), label: X.data.communes },
      { value: formatCount(dist.peopleOver10km, lang), label: X.data.people },
      { value: formatCount(dist.datasets, lang), label: X.data.datasets },
    ],
  };

  const slides: HeroSlide[] = [
    // When the multi-screening health check is public, it leads; otherwise the diabetes + heart check does.
    healthCheckLive
      ? { ...L.heroCheck, href: `${base}/check`, visual: riskVisual }
      : { ...L.hero[0], href: `${base}/risk`, visual: riskVisual },
    { ...L.hero[1], href: `${base}/lab`, visual: labVisual },
    {
      ...L.hero[3],
      desc: fmt(L.hero[3].desc, { count: n(stats.datasets) }),
      href: `${base}/insights`,
      visual: dataVisual,
    },
  ];

  const features = [
    ...(healthCheckLive
      ? [
          {
            href: `${base}/check`,
            icon: IconHealthCheck,
            title: t.home.healthCheck,
            body: t.home.healthCheckHint,
          },
        ]
      : []),
    {
      href: `${base}/risk`,
      icon: IconHeartRisk,
      title: t.home.checkRisk,
      body: t.home.checkRiskHint,
    },
    {
      href: `${base}/lab`,
      icon: IconLabTube,
      title: t.home.explainLab,
      body: t.home.explainLabHint,
    },
    {
      href: `${base}/insights`,
      icon: IconTempleData,
      title: t.home.insights,
      body: t.home.insightsHint,
    },
  ];

  const problemStats = [
    { s: stats.htnDiagnosed, label: L.problem.stats.diagnosed },
    { s: stats.htnControlled, label: L.problem.stats.controlled },
    { s: stats.outOfPocket, label: L.problem.stats.outOfPocket },
  ].filter((x) => x.s);

  const impact = [
    { value: stats.facilities, label: L.impact.facilities },
    { value: stats.provinces, label: L.impact.provinces },
    { value: stats.communes, label: L.impact.communes },
    { value: stats.datasets, label: L.impact.datasets },
  ];

  return (
    // Motion (scroll reveals) is loaded on the home page only, keeping other pages light on 3G.
    <MotionProvider>
      <div className="page-full">
        {/* 1. Hero carousel (sits under the transparent navbar) */}
        <div className="relative -mt-16 overflow-hidden pt-16">
          <HeroCarousel slides={slides} labels={L.carousel} lang={lang} />
          <p className="mx-auto flex w-full max-w-6xl items-center gap-2 px-5 pb-10 text-caption text-secondary sm:px-8">
            <Lock aria-hidden size={16} className="shrink-0" />
            {t.home.privacy}
          </p>
        </div>

        {/* 2. Problem → solution */}
        <Section id="problem" tone="tinted">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <RevealItem>
                <p className="eyebrow">{L.problem.eyebrow}</p>
              </RevealItem>
              <RevealItem>
                <h2 className="mt-2 text-h1 font-semibold text-balance">
                  {L.problem.title}
                </h2>
              </RevealItem>
              <RevealItem>
                <p className="mt-3 text-body text-secondary">{L.problem.body}</p>
              </RevealItem>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {problemStats.map(({ s, label }) => (
                  <RevealItem key={label} className="card p-5">
                    <p className="text-h1 font-semibold">
                      <StatCounter
                        value={s!.value}
                        lang={lang}
                        suffix="%"
                        decimals={Number.isInteger(s!.value) ? 0 : 1}
                      />
                    </p>
                    <p className="mt-1 text-label">{label}</p>
                    <p className="mt-2 text-caption text-secondary">
                      {SOURCE_LABEL[s!.source] ?? s!.source},{" "}
                      {formatNumber(s!.year, lang)}
                    </p>
                  </RevealItem>
                ))}
              </div>
            </Reveal>
            <Reveal>
              <RevealItem className="card p-5 sm:p-8">
                <p className="eyebrow">{L.solution.eyebrow}</p>
                <h2 className="mt-2 text-h2 font-semibold text-balance">
                  {fmt(L.solution.title, { app })}
                </h2>
                <ul className="mt-5 flex flex-col gap-3">
                  {L.solution.points.map((p) => (
                    <li key={p} className="flex gap-3">
                      <CircleCheck
                        aria-hidden
                        size={20}
                        className="mt-0.5 shrink-0 text-secondary"
                      />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </RevealItem>
            </Reveal>
          </div>
        </Section>

        {/* 3. Features */}
        <Section
          id="features"
          eyebrow={L.features.eyebrow}
          title={L.features.title}
        >
          <Reveal
            as="ul"
            className={`grid gap-3 sm:grid-cols-2 ${features.length > 4 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
          >
            {features.map((f) => (
              <RevealItem as="li" key={f.href}>
                <Card interactive className="h-full">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-secondary">
                    <f.icon size={20} />
                  </span>
                  <h3 className="mt-4 text-h3 font-semibold">
                    <Link
                      href={f.href}
                      className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
                    >
                      {f.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-body text-secondary">{f.body}</p>
                  <p className="mt-4 inline-flex items-center gap-1 text-label font-medium text-gold">
                    {L.features.open}
                    <ArrowRight aria-hidden size={16} />
                  </p>
                </Card>
              </RevealItem>
            ))}
          </Reveal>
        </Section>

        {/* 4. How it works */}
        <Section
          id="how"
          eyebrow={L.how.eyebrow}
          title={L.how.title}
          tone="tinted"
        >
          <Reveal
            as="ol"
            className="grid gap-8 md:grid-cols-4 md:gap-6"
            stagger={0.08}
          >
            {L.how.steps.map((s, i) => (
              <RevealItem
                as="li"
                key={s.title}
                className="flex gap-4 md:flex-col"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong text-label font-semibold text-gold tabular-nums">
                  {formatNumber(i + 1, lang)}
                </span>
                <div>
                  <h3 className="text-h3 font-semibold">{s.title}</h3>
                  <p className="mt-1 text-body text-secondary">{s.body}</p>
                </div>
              </RevealItem>
            ))}
          </Reveal>
        </Section>

        {/* 5. Impact / data */}
        <Section
          id="impact"
          eyebrow={L.impact.eyebrow}
          title={L.impact.title}
          intro={L.impact.body}
        >
          <Reveal
            as="ul"
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            {impact.map((s) => (
              <RevealItem
                as="li"
                key={s.label}
                className="card p-5"
              >
                <p className="text-h1 font-semibold">
                  <StatCounter value={s.value} lang={lang} />
                </p>
                <p className="mt-1 text-label text-secondary">{s.label}</p>
              </RevealItem>
            ))}
          </Reveal>
        </Section>

        {/* 6. Team */}
        <Section
          id="team"
          eyebrow={L.team.eyebrow}
          title={fmt(L.team.title, { app })}
          intro={L.team.body}
          tone="tinted"
        >
          <TeamGrid lang={lang} />
        </Section>

        {/* 7. Call to action */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <Reveal>
              {/* Quiet closing card (was a gradient panel). Its button is the only gold one in view. */}
              <RevealItem className="card flex flex-col items-start gap-4 p-5 sm:p-10">
                <h2 className="text-h1 font-semibold text-balance">
                  {fmt(L.cta.title, { app })}
                </h2>
                <p className="max-w-xl text-body text-secondary">
                  {healthCheckLive ? L.cta.bodyCheck : L.cta.body}
                </p>
                <Link
                  href={healthCheckLive ? `${base}/check` : `${base}/risk`}
                  className="btn-primary w-full sm:w-auto"
                >
                  {healthCheckLive ? L.heroCheck.cta : t.home.checkRisk}
                  <ArrowRight aria-hidden size={20} />
                </Link>
              </RevealItem>
            </Reveal>
          </div>
        </section>
      </div>
    </MotionProvider>
  );
}
