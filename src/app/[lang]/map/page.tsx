import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/i18n";
import { FACILITY_TYPES, listAreas } from "@/server/data/facilities";
import { MapExplorer } from "@/components/features/map/MapExplorer";
import { MapExplorerFromQuery } from "@/components/features/map/MapExplorerFromQuery";

/** Date the open datasets were downloaded and cleaned (see data/SOURCES.md). */
const DATA_UPDATED = "2026-11-22";

export default async function MapPage({ params }: PageProps<"/[lang]/map">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const areas = listAreas();

  // ?type= is read in the browser so this page stays static.
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-2xl font-bold">{t.map.title}</h1>
      <Suspense fallback={<MapExplorer lang={lang} t={t} areas={areas} typeFilter={null} dataUpdated={DATA_UPDATED} />}>
        <MapExplorerFromQuery lang={lang} t={t} areas={areas} types={FACILITY_TYPES} dataUpdated={DATA_UPDATED} />
      </Suspense>
    </div>
  );
}
