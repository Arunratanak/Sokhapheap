import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { FACILITY_TYPES, listAreas, type FacilityType } from "@/lib/facilities";
import { MapExplorer } from "@/components/map/MapExplorer";

/** Date the open datasets were downloaded and cleaned (see data/SOURCES.md). */
const DATA_UPDATED = "2026-11-22";

export default async function MapPage({ params, searchParams }: PageProps<"/[lang]/map">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const sp = await searchParams;
  const typeFilter = FACILITY_TYPES.includes(sp.type as FacilityType) ? (sp.type as FacilityType) : null;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-2xl font-bold">{t.map.title}</h1>
      <MapExplorer lang={lang} t={t} areas={listAreas()} typeFilter={typeFilter} dataUpdated={DATA_UPDATED} />
    </div>
  );
}
