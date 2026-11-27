import { API_BASE, BASE_PATH } from "@/lib/client/api-base";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fmt, formatNumber, getDictionary, hasLocale } from "@/i18n";
import { areas, gap, manifest, nationalContext, provinceNames } from "@/server/insights/data";
import { InsightsExplorer, type RankRow } from "@/components/features/insights/InsightsExplorer";
import { Download, Info, Plug } from "lucide-react";

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
        <h1 className="text-h1 font-semibold">{ti.title}</h1>
        <p className="text-body text-secondary">{ti.intro}</p>
        <p className="flex items-start gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2 text-caption text-secondary"><Info aria-hidden size={16} className="mt-0.5 shrink-0" />{ti.planningNote}</p>
      </header>

      <section aria-labelledby="national-title">
        <h2 id="national-title" className="mb-3 text-h2 font-semibold">{ti.national.title}</h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((c) => (
            <li key={c.key} className="card p-5">
              <p className="text-h1 font-semibold tabular-nums">{c.value}</p>
              <p className="mt-1 text-label">{c.label}</p>
              {c.extra && <p className="text-caption text-secondary">{c.extra}</p>}
              <p className="mt-2 text-caption text-secondary">{c.source}</p>
            </li>
          ))}
        </ul>
      </section>

      <InsightsExplorer lang={lang} t={t} ranking={ranking} />

      <section aria-labelledby="method-title" className="flex flex-col gap-2">
        <h2 id="method-title" className="text-h2 font-semibold">{ti.method.title}</h2>
        <p>{ti.method.p1}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{ti.method.risk}</li>
          <li>{ti.method.access}</li>
          <li>{ti.method.capacity}</li>
          <li>{ti.method.people}</li>
          <li>{ti.method.poverty}</li>
        </ul>
        <p>{ti.method.p2}</p>
        <h3 className="mt-2 font-semibold">{ti.method.limitsTitle}</h3>
        <ul className="list-disc space-y-2 pl-5 text-label">
          <li>{ti.method.l1}</li>
          <li>{ti.method.l2}</li>
          <li>{ti.method.l3}</li>
          <li>{ti.method.l4}</li>
        </ul>
        <p className="flex items-start gap-2 text-caption text-secondary"><Info aria-hidden size={16} className="mt-0.5 shrink-0" />{ti.planningNote}</p>
      </section>

      <section aria-labelledby="downloads-title" className="card flex flex-col gap-3 p-5">
        <h2 id="downloads-title" className="text-h2 font-semibold">{ti.downloads.title}</h2>
        <p className="text-body text-secondary">{ti.downloads.body}</p>
        <div className="flex flex-wrap gap-3">
          <a className="btn-secondary" href={`${API_BASE}/api/open-data/download/areas_district.csv`} download><Download aria-hidden size={20} /> {ti.downloads.csv}</a>
          <a className="btn-secondary" href={`${API_BASE}/api/open-data/download/gap_index.geojson`} download><Download aria-hidden size={20} /> {ti.downloads.geojson}</a>
        </div>
        <p className="text-caption text-secondary">{ti.downloads.citation}</p>
        <a href={`${BASE_PATH}/${lang}/insights/api`} className="inline-flex min-h-11 items-center gap-2 text-label font-medium text-gold underline underline-offset-2"><Plug aria-hidden size={16} /> {ti.apiLink}</a>
      </section>

      <section aria-labelledby="sources-title" className="flex flex-col gap-2">
        <h2 id="sources-title" className="text-h2 font-semibold">{ti.sources.title}</h2>
        <ul className="flex flex-col gap-3 text-label">
          {sources.map((s) => (
            <li key={s.id} className="card p-5">
              <a href={s.url} className="font-semibold text-gold underline underline-offset-2" rel="noopener noreferrer" target="_blank">{s.name}</a>
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
