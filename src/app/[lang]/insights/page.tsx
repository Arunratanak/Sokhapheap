import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fmt, formatNumber, getDictionary, hasLocale } from "@/lib/i18n";
import { areas, gap, manifest, nationalContext, provinceNames } from "@/lib/insights/data";
import { InsightsExplorer, type RankRow } from "@/components/insights/InsightsExplorer";

export async function generateMetadata({ params }: PageProps<"/[lang]/insights">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang).insights;
  const strip = (s: string) => s.replaceAll("​", "");
  return { title: `${strip(t.title)} · SokhaPheap`, description: strip(t.intro) };
}

export default async function InsightsPage({ params }: PageProps<"/[lang]/insights">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const ti = t.insights;

  const provs = provinceNames();
  const districtData = new Map(areas("district").map((d) => [d.pcode, d]));
  const ranking: RankRow[] = gap("district").map((g) => {
    const d = districtData.get(g.pcode)!;
    return {
      pcode: g.pcode,
      name: g.name_en,
      province: provs.get(String(g.province_pcode)) ?? "",
      index: g.index,
      rank: g.rank,
      drivers: g.drivers,
      motor: d.travel_motor_mean_min,
      per10k: d.facilities_per_10k,
    };
  });

  const nat = nationalContext().indicators;
  const card = (key: string, label: string, extra?: string) => {
    const x = nat[key];
    if (!x || x.value === null) return null;
    const src = x.source === "who-gho" ? "WHO" : "World Bank";
    return { key, label, value: `${formatNumber(x.value, lang)}%`, extra, source: fmt(ti.national.source, { source: src, year: x.year }, lang) };
  };
  const hyp = nat.hypertension_controlled_pct;
  const cards = [
    card("diabetes_prevalence_agestd_pct", ti.national.diabetes),
    card("hypertension_30_79_agestd_pct", ti.national.hypertension, hyp?.value != null ? `${formatNumber(hyp.value, lang)}% ${ti.national.hypertensionControlled}` : undefined),
    card("overweight_adults_agestd_pct", ti.national.overweight),
    card("out_of_pocket_share_of_health_spending_pct", ti.national.oop),
  ].filter((c): c is NonNullable<typeof c> => c !== null);

  const sources = manifest();

  return (
    <div className="page-wide flex w-full min-w-0 flex-col gap-8 pt-2">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{ti.title}</h1>
        <p>{ti.intro}</p>
        <p className="rounded-xl border-l-4 border-warn-border bg-warn-soft px-3 py-2 text-sm">ℹ️ {ti.planningNote}</p>
      </header>

      <section aria-labelledby="national-title">
        <h2 id="national-title" className="mb-2 text-lg font-bold">{ti.national.title}</h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((c) => (
            <li key={c.key} className="rounded-xl border border-black/10 bg-surface p-3">
              <p className="text-2xl font-bold text-brand-strong">{c.value}</p>
              <p className="text-sm">{c.label}</p>
              {c.extra && <p className="text-xs text-muted">{c.extra}</p>}
              <p className="mt-1 text-xs text-muted">{c.source}</p>
            </li>
          ))}
        </ul>
      </section>

      <InsightsExplorer lang={lang} t={t} ranking={ranking} />

      <section aria-labelledby="method-title" className="flex flex-col gap-2">
        <h2 id="method-title" className="text-xl font-bold">{ti.method.title}</h2>
        <p>{ti.method.p1}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{ti.method.risk}</li>
          <li>{ti.method.access}</li>
          <li>{ti.method.capacity}</li>
          <li>{ti.method.people}</li>
          <li>{ti.method.poverty}</li>
        </ul>
        <p>{ti.method.p2}</p>
        <h3 className="mt-2 font-semibold">{ti.method.limitsTitle}</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>{ti.method.l1}</li>
          <li>{ti.method.l2}</li>
          <li>{ti.method.l3}</li>
          <li>{ti.method.l4}</li>
        </ul>
        <p className="text-sm font-medium">ℹ️ {ti.planningNote}</p>
      </section>

      <section aria-labelledby="downloads-title" className="flex flex-col gap-2 rounded-2xl bg-brand-soft p-4">
        <h2 id="downloads-title" className="text-xl font-bold">{ti.downloads.title}</h2>
        <p className="text-sm">{ti.downloads.body}</p>
        <div className="flex flex-wrap gap-3">
          <a className="btn-secondary" href="/api/open-data/download/areas_district.csv" download>⬇️ {ti.downloads.csv}</a>
          <a className="btn-secondary" href="/api/open-data/download/gap_index.geojson" download>⬇️ {ti.downloads.geojson}</a>
        </div>
        <p className="text-xs text-muted">{ti.downloads.citation}</p>
      </section>

      <section aria-labelledby="sources-title" className="flex flex-col gap-2">
        <h2 id="sources-title" className="text-xl font-bold">{ti.sources.title}</h2>
        <ul className="flex flex-col gap-3 text-sm">
          {sources.map((s) => (
            <li key={s.id} className="rounded-xl border border-black/10 bg-surface p-3">
              <a href={s.url} className="font-semibold text-brand-strong underline underline-offset-2" rel="noopener noreferrer" target="_blank">{s.name}</a>
              <p className="text-muted">{s.publisher}</p>
              <p>
                {ti.sources.licence}: {s.licence_url ? <a href={s.licence_url} className="underline" rel="noopener noreferrer" target="_blank">{s.licence}</a> : s.licence}
                {" · "}{ti.sources.year}: {s.data_year}
              </p>
              <p className="text-muted">{ti.sources.usedFor}: {s.used_for}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
