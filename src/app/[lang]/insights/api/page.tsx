import { API_BASE } from "@/lib/client/api-base";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/insights/api">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: `${getDictionary(lang).apiDocs.title.replaceAll("​", "")} · SokhaPheap` };
}

function Endpoint({ path, desc, example }: { path: string; desc: string; example: string }) {
  return (
    <li className="card flex flex-col gap-1 p-5">
      <code className="break-all font-mono text-sm font-semibold">GET {path}</code>
      <p className="text-label text-secondary">{desc}</p>
      <a href={API_BASE + example} className="break-all font-mono text-caption text-gold underline underline-offset-2">{example}</a>
    </li>
  );
}

export default async function ApiDocsPage({ params }: PageProps<"/[lang]/insights/api">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const a = getDictionary(lang).apiDocs;
  return (
    <div className="flex flex-col gap-5 pt-2">
      <h1 className="text-h1 font-semibold">{a.title}</h1>
      <p>{a.intro}</p>
      <p className="card p-4 text-label">{a.licence}</p>
      <p className="text-caption text-secondary">{a.limits}</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-h3 font-semibold">{a.endpoints}</h2>
        <ul className="flex flex-col gap-3">
          <Endpoint path="/api/open-data/areas?level=province|district" desc={a.areasDesc} example="/api/open-data/areas?level=province" />
          <Endpoint path="/api/open-data/areas/{pcode}" desc={a.areaDesc} example="/api/open-data/areas/KH1901" />
          <Endpoint path="/api/open-data/sources" desc={a.sourcesDesc} example="/api/open-data/sources" />
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-h3 font-semibold">{a.downloadsTitle}</h2>
        <p className="text-label text-secondary">{a.downloadsDesc}</p>
        <ul className="list-disc pl-5 font-mono text-caption">
          <li><a className="underline" href={`${API_BASE}/api/open-data/download/areas_district.csv`}>/api/open-data/download/areas_district.csv</a></li>
          <li><a className="underline" href={`${API_BASE}/api/open-data/download/gap_index.geojson`}>/api/open-data/download/gap_index.geojson</a></li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-h3 font-semibold">{a.fieldsTitle}</h2>
        <ul className="list-disc space-y-1 pl-5 text-label">
          {a.fields.map((f) => <li key={f}>{f}</li>)}
        </ul>
      </section>

      <p className="text-caption text-secondary">{a.note}</p>
      <Link href={`/${lang}/insights`} className="btn-ghost justify-start px-0">← {a.back}</Link>
    </div>
  );
}
