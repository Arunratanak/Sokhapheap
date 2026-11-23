import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fmt, formatNumber, getDictionary, hasLocale } from "@/lib/i18n";
import { gap } from "@/lib/insights/data";
import { planFor, provinceSvg, provinces } from "@/lib/insights/planner";
import { PALETTE, colourFor, quantileBreaks } from "@/lib/insights/layers";
import { PrintButton } from "@/components/org/PrintButton";

/** Printable one-page screening plan (open data only). Linked from the organization dashboard. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return provinces().map((p) => ({ province: p.pcode }));
}

export default async function PlanPage({ params }: PageProps<"/[lang]/plan/[province]">) {
  const { lang, province } = await params;
  if (!hasLocale(lang)) notFound();
  const plan = planFor(province);
  if (!plan) notFound();
  const t = getDictionary(lang);
  const p = t.planner;
  const n = (v: number | null) => (v === null ? "—" : formatNumber(v, lang));
  const grouped = (v: number | null) => (v === null ? "—" : v.toLocaleString("en").replace(/\d/g, (d) => (lang === "km" ? "០១២៣៤៥៦៧៨៩"[Number(d)] : d)));

  const all = gap("district");
  const breaks = quantileBreaks(all.map((g) => g.index));
  const byPcode = new Map(all.map((g) => [g.pcode, g.index]));
  const svg = provinceSvg(province, new Map(plan.top.map((d) => [d.pcode, d.rankInProvince])), (pc) => colourFor(byPcode.get(pc) ?? null, breaks));
  const driver = (x: string) => t.insights.components[x as keyof typeof t.insights.components];

  return (
    <div className="print-page flex flex-col gap-3 pt-2 text-sm print:gap-2 print:pt-0 print:text-[10pt]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold print:text-lg">{fmt(p.planTitle, { province: plan.province.name }, lang)}</h1>
          <p className="text-muted">{fmt(p.planSubtitle, { n: plan.top.length, total: plan.districtsInProvince }, lang)}</p>
        </div>
        <PrintButton label={p.printNow} />
      </div>
      <p className="rounded-lg border-l-4 border-warn-border bg-warn-soft px-3 py-1.5 text-xs">ℹ️ {p.planningNote}</p>

      <figure className="flex flex-col items-center">
        <svg viewBox={`0 0 ${svg.width} ${svg.height}`} className="h-auto max-h-[300px] w-full max-w-md print:max-h-[200px]" role="img" aria-label={fmt(p.mapCaption, { province: plan.province.name }, lang)}>
          {svg.shapes.map((s) => (
            <path key={s.pcode} d={s.d} fill={s.fill} stroke="#ffffff" strokeWidth={1}>
              <title>{s.name}</title>
            </path>
          ))}
          {svg.shapes.filter((s) => s.label).map((s) => (
            <g key={`l${s.pcode}`}>
              <circle cx={s.cx} cy={s.cy} r={11} fill="#111827" />
              <text x={s.cx} y={s.cy + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="#ffffff">{s.label}</text>
            </g>
          ))}
        </svg>
        <figcaption className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
          {fmt(p.mapCaption, { province: plan.province.name }, lang)}
          <span className="inline-flex" aria-hidden>{PALETTE.map((c) => <span key={c} className="inline-block h-3 w-4" style={{ background: c }} />)}</span>
        </figcaption>
      </figure>

      <table className="w-full border-collapse text-left text-xs">
        <thead className="bg-brand-soft">
          <tr>
            <th scope="col" className="p-1.5">{p.colRank}</th>
            <th scope="col" className="p-1.5">{p.colDistrict}</th>
            <th scope="col" className="p-1.5 text-right">{p.colIndex}</th>
            <th scope="col" className="p-1.5">{p.colDrivers}</th>
            <th scope="col" className="p-1.5 text-right">{p.colAdults}</th>
            <th scope="col" className="p-1.5 text-right">{p.colTravel}</th>
            <th scope="col" className="p-1.5">{p.colCentres}</th>
          </tr>
        </thead>
        <tbody>
          {plan.top.map((d) => (
            <tr key={d.pcode} className="border-t border-black/10 align-top">
              <td className="p-1.5 font-bold">{n(d.rankInProvince)}</td>
              <td className="p-1.5 font-semibold">{d.name}<br /><span className="font-normal text-muted">{fmt(p.nationalRank, { rank: d.rankNational }, lang)}</span></td>
              <td className="p-1.5 text-right">{n(d.index)}</td>
              <td className="p-1.5">{d.drivers.map(driver).join(", ") || "—"}</td>
              <td className="p-1.5 text-right">{grouped(d.adults)}</td>
              <td className="p-1.5 text-right">{n(d.travelMotorMin === null ? null : Math.round(d.travelMotorMin))}</td>
              <td className="p-1.5">
                {d.healthCentres.length
                  ? `${d.healthCentres.slice(0, 3).map((h) => h.name).join(", ")}${d.healthCentres.length > 3 ? ` ${fmt(p.moreCentres, { n: d.healthCentres.length - 3 }, lang)}` : ""}`
                  : p.noCentres}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="text-[10px] leading-snug text-muted print:text-[7.5pt]">
        <h2 className="font-semibold text-foreground">{p.sources}</h2>
        <ul>
          {plan.sources.map((s) => (
            <li key={s.name}>{s.name} — {s.publisher}. {s.licence}. {s.year}.</li>
          ))}
        </ul>
        <p className="mt-1">{p.generated}</p>
      </section>
    </div>
  );
}
