import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ChartColumn,
  CircleCheck,
  FlaskConical,
  HeartPulse,
  Lock,
  Stethoscope,
} from "lucide-react";
import { fmt, formatNumber, getDictionary, hasLocale } from "@/lib/i18n";
import { visibleModules } from "@/lib/modules/registry";
import { homeStats } from "@/lib/insights/data";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
import { TeamGrid } from "@/components/home/TeamGrid";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Reveal, RevealItem } from "@/components/ui/Reveal";
import { StatCounter } from "@/components/ui/StatCounter";
import { formatCount } from "@/lib/format";
import { MotionProvider } from "@/components/ui/MotionProvider";
import type { HeroVisualData, Tone } from "@/components/home/HeroVisual";
import { distanceExample, labExample, riskExample } from "@/lib/heroExamples";

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

  // Example cards: values computed with the real scoring / lab / open-data logic (src/lib/heroExamples.ts).
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
            icon: Stethoscope,
            title: t.home.healthCheck,
            body: t.home.healthCheckHint,
          },
        ]
      : []),
    {
      href: `${base}/risk`,
      icon: HeartPulse,
      title: t.home.checkRisk,
      body: t.home.checkRiskHint,
    },
    {
      href: `${base}/lab`,
      icon: FlaskConical,
      title: t.home.explainLab,
      body: t.home.explainLabHint,
    },
    {
      href: `${base}/insights`,
      icon: ChartColumn,
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
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="absolute -top-40 -right-32 h-[36rem] w-[36rem] rounded-full opacity-25 blur-3xl [background:var(--gradient)] dark:opacity-15" />
            <div className="absolute top-1/3 -left-40 h-[28rem] w-[28rem] rounded-full bg-gold-soft opacity-30 blur-3xl dark:opacity-10" />
            <div className="absolute inset-0 [background-image:radial-gradient(var(--line)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)] opacity-70" />
          </div>
          <HeroCarousel slides={slides} labels={L.carousel} lang={lang} />
          <p className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 pb-10 text-sm text-muted sm:px-6">
            <Lock aria-hidden size={15} className="shrink-0 text-accent" />
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
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  {L.problem.title}
                </h2>
              </RevealItem>
              <RevealItem>
                <p className="mt-4 text-lg text-muted">{L.problem.body}</p>
              </RevealItem>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {problemStats.map(({ s, label }) => (
                  <RevealItem key={label} className="card p-5">
                    <p className="text-3xl font-extrabold tracking-tight text-brand-strong">
                      <StatCounter
                        value={s!.value}
                        lang={lang}
                        suffix="%"
                        decimals={Number.isInteger(s!.value) ? 0 : 1}
                      />
                    </p>
                    <p className="mt-2 text-sm">{label}</p>
                    <p className="mt-2 text-xs text-muted">
                      {SOURCE_LABEL[s!.source] ?? s!.source},{" "}
                      {formatNumber(s!.year, lang)}
                    </p>
                  </RevealItem>
                ))}
              </div>
            </Reveal>
            <Reveal>
              <RevealItem className="card relative overflow-hidden p-7 sm:p-9">
                <div
                  aria-hidden
                  className="absolute -top-24 -right-24 h-56 w-56 rounded-full opacity-20 blur-2xl [background:var(--gradient)]"
                />
                <p className="eyebrow">{L.solution.eyebrow}</p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                  {fmt(L.solution.title, { app })}
                </h2>
                <ul className="mt-6 flex flex-col gap-4">
                  {L.solution.points.map((p) => (
                    <li key={p} className="flex gap-3">
                      <CircleCheck
                        aria-hidden
                        size={22}
                        className="mt-0.5 shrink-0 text-accent"
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
            className={`grid gap-5 sm:grid-cols-2 ${features.length > 4 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
          >
            {features.map((f) => (
              <RevealItem as="li" key={f.href}>
                <Card interactive className="h-full">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong transition-transform duration-300 group-hover:scale-110">
                    <f.icon aria-hidden size={24} />
                  </span>
                  <h3 className="mt-5 text-lg font-bold">
                    <Link
                      href={f.href}
                      className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
                    >
                      {f.title}
                    </Link>
                  </h3>
                  <p className="mt-2 text-sm text-muted">{f.body}</p>
                  <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-strong">
                    {L.features.open}
                    <ArrowRight
                      aria-hidden
                      size={16}
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    />
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
            className="relative grid gap-8 md:grid-cols-4 md:gap-6"
            stagger={0.12}
          >
            <span
              aria-hidden
              className="absolute top-6 bottom-6 left-6 w-0.5 bg-gradient-to-b from-accent/60 via-gold/50 to-transparent md:top-6 md:right-[12.5%] md:bottom-auto md:left-[12.5%] md:h-0.5 md:w-auto md:bg-gradient-to-r"
            />
            {L.how.steps.map((s, i) => (
              <RevealItem
                as="li"
                key={s.title}
                className="relative flex gap-5 md:flex-col md:items-center md:text-center"
              >
                <span className="relative z-10 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-[#1c1917] shadow-md ring-4 ring-background [background:var(--gradient)]">
                  {formatNumber(i + 1, lang)}
                </span>
                <div>
                  <h3 className="text-lg font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{s.body}</p>
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
            className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6"
          >
            {impact.map((s) => (
              <RevealItem
                as="li"
                key={s.label}
                className="card px-3 py-6 text-center sm:p-6"
              >
                <p className="text-gradient px-1 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                  <StatCounter value={s.value} lang={lang} />
                </p>
                <p className="mt-2 text-sm text-muted">{s.label}</p>
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
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <RevealItem className="relative overflow-hidden rounded-3xl px-6 py-14 text-center text-[#1c1917] shadow-lg sm:px-12 [background:var(--gradient)]">
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgb(255_255_255/0.6)_1px,transparent_1px)] [background-size:18px_18px]"
                />
                <div
                  aria-hidden
                  className="absolute -right-16 -bottom-24 h-72 w-72 rounded-full bg-white/25 blur-2xl"
                />
                <div className="relative">
                  <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
                    {fmt(L.cta.title, { app })}
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-lg text-[#1c1917]/80">
                    {healthCheckLive ? L.cta.bodyCheck : L.cta.body}
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Link
                      href={healthCheckLive ? `${base}/check` : `${base}/risk`}
                      className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-[#1c1917] px-6 text-lg font-semibold text-white shadow-md transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                      {healthCheckLive ? L.heroCheck.cta : t.home.checkRisk}
                      <ArrowRight aria-hidden size={20} />
                    </Link>
                  </div>
                </div>
              </RevealItem>
            </Reveal>
          </div>
        </section>
      </div>
    </MotionProvider>
  );
}
