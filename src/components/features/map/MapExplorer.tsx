"use client";

import { API_BASE } from "@/lib/client/api-base";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { fmtClient, getPosition, inCambodia } from "@/lib/client/util";
import { FacilityList, TYPE_STYLE, type FacilityItem } from "@/components/features/map/FacilityList";
import { LocateFixed, Map as MapIcon } from "lucide-react";

const FacilityMap = dynamic(() => import("./FacilityMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-80 w-full rounded-2xl sm:h-96" />,
});

type Area = { province: string; districts: string[] };
type Mode = "idle" | "locating" | "located" | "area";

export function MapExplorer({
  lang, t, areas, typeFilter, dataUpdated,
}: { lang: Locale; t: Dictionary; areas: Area[]; typeFilter: FacilityItem["type"] | null; dataUpdated: string }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [user, setUser] = useState<{ lat: number; lng: number } | null>(null);
  const [items, setItems] = useState<FacilityItem[]>([]);
  const [denied, setDenied] = useState(false);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [loading, setLoading] = useState(false);
  // List first: the Leaflet map (JS, tiles and all 1,440 markers) only loads when asked for.
  const [showMap, setShowMap] = useState(false);

  async function locate() {
    setMode("locating");
    setDenied(false);
    try {
      const pos = await getPosition();
      if (!inCambodia(pos.lat, pos.lng)) throw new Error("outside Cambodia");
      setUser(pos);
      const q = new URLSearchParams({ lat: String(pos.lat), lng: String(pos.lng), limit: "5", ...(typeFilter ? { type: typeFilter } : {}) });
      const { facilities } = await (await fetch(`${API_BASE}/api/facilities/nearest?${q}`)).json();
      setItems(facilities);
      setMode("located");
    } catch {
      setDenied(true);
      setMode("area");
    }
  }

  async function loadArea(p: string, d: string) {
    setProvince(p);
    setDistrict(d);
    if (!p) return setItems([]);
    setLoading(true);
    try {
      const q = new URLSearchParams({ province: p, ...(d ? { district: d } : {}) });
      const { facilities } = await (await fetch(`${API_BASE}/api/facilities/by-area?${q}`)).json();
      setItems((facilities as FacilityItem[]).filter((f) => !typeFilter || f.type === typeFilter));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const districts = areas.find((a) => a.province === province)?.districts ?? [];
  const shown = mode === "area" ? items.slice(0, 30) : items;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <button className="btn-primary" onClick={locate} disabled={mode === "locating"}>
          <LocateFixed aria-hidden size={20} /> {mode === "locating" ? t.map.locating : t.map.useLocation}
        </button>
        {denied && <p className="rounded-xl bg-surface-2 px-3 py-2 text-body" role="status">{t.map.locationDenied}</p>}
        {mode !== "area" && !denied && (
          <button className="btn-ghost" onClick={() => setMode("area")}>{t.map.chooseProvince} / {t.map.chooseDistrict}</button>
        )}
        {mode === "area" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-label font-medium">
              {t.map.chooseProvince}
              <select className="field" value={province} onChange={(e) => loadArea(e.target.value, "")}>
                <option value="">{t.map.select}</option>
                {areas.map((a) => <option key={a.province} value={a.province}>{a.province}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-label font-medium">
              {t.map.chooseDistrict}
              <select className="field" value={district} disabled={!province} onChange={(e) => loadArea(province, e.target.value)}>
                <option value="">{t.map.allDistricts}</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      <button className="btn-secondary" aria-expanded={showMap} aria-controls="facility-map" onClick={() => setShowMap((v) => !v)}>
        <MapIcon aria-hidden size={20} /> {showMap ? t.map.hideMap : t.map.showMap}
      </button>

      {showMap && (
        <div id="facility-map" className="flex flex-col gap-2">
          <FacilityMap focus={shown} user={user} lang={lang} ariaLabel={t.map.title} />
          <div aria-label={t.map.legend} className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-secondary">
            {(Object.keys(TYPE_STYLE) as FacilityItem["type"][]).filter((k) => k !== "other").map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TYPE_STYLE[k].color }} />
                {t.map.types[k]}
              </span>
            ))}
          </div>
        </div>
      )}

      {(mode === "located" || (mode === "area" && province)) && (
        <section aria-live="polite">
          <h2 className="mb-3 text-h2 font-semibold">{mode === "located" ? t.map.nearestTitle : t.map.inAreaTitle}</h2>
          {mode === "area" && !loading && items.length > 0 && (
            <p className="mb-3 text-caption text-secondary">{fmtClient(t.map.showingCount, { n: shown.length }, lang)}</p>
          )}
          {loading ? <div role="status" className="flex flex-col gap-3"><span className="sr-only">{t.common.loading}</span><div className="skeleton h-28 rounded-2xl" /><div className="skeleton h-28 rounded-2xl" /></div> : <FacilityList items={shown} lang={lang} t={t} />}
        </section>
      )}

      <p className="text-caption text-secondary">{t.map.callAhead}</p>
      <p className="text-caption text-secondary">{fmtClient(t.map.dataCredit, { date: dataUpdated }, lang)}</p>
    </div>
  );
}
