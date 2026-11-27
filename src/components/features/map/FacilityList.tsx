"use client";

import { BriefcaseMedical, Cross, Hospital, MapPin, Navigation, Stethoscope, type LucideIcon } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n";
import { fmtClient, formatKm } from "@/lib/client/util";

export interface FacilityItem {
  id: string;
  name: string;
  name_km: string | null;
  type: "hospital" | "health_centre" | "health_post" | "clinic" | "other";
  province: string;
  district: string | null;
  lat: number;
  lng: number;
  source: "moh_2010" | "osm";
  distance_m?: number;
}

/**
 * Facility types: a muted categorical colour (map markers and the legend; Leaflet draws on a canvas, so these
 * are real colours rather than CSS variables, kept here in one place) and a Lucide icon. None of them is a
 * status colour, so a hospital marker never reads as "out of range".
 */
export const TYPE_STYLE: Record<FacilityItem["type"], { color: string; Icon: LucideIcon }> = {
  hospital: { color: "#c07a52", Icon: Hospital },
  health_centre: { color: "#5d9a83", Icon: Cross },
  health_post: { color: "#a08a4a", Icon: BriefcaseMedical },
  clinic: { color: "#6f8db3", Icon: Stethoscope },
  other: { color: "#8d8576", Icon: MapPin },
};

export function directionsUrl(f: { lat: number; lng: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`;
}

export function FacilityList({ items, lang, t }: { items: FacilityItem[]; lang: Locale; t: Dictionary }) {
  if (!items.length) return <p className="text-body text-secondary">{t.map.noResults}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((f) => {
        const s = TYPE_STYLE[f.type];
        const name = lang === "km" && f.name_km ? f.name_km : f.name;
        return (
          <li key={f.id} className="card p-5">
            <div className="flex items-start gap-3">
              <span aria-hidden className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2" style={{ color: s.color }}>
                <s.Icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-h3 font-semibold">{name}</p>
                <p className="text-caption text-secondary">
                  <span className="font-medium">{t.map.types[f.type]}</span>
                  {" · "}
                  {[f.district, f.province].filter(Boolean).join(", ")}
                  {f.distance_m !== undefined && <> · <span className="tabular-nums">{fmtClient(t.map.distanceKm, { km: formatKm(f.distance_m, lang) }, lang)}</span></>}
                </p>
                <a
                  href={directionsUrl(f)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary mt-3 min-h-11 px-4"
                >
                  <Navigation aria-hidden size={16} /> {t.map.directions}
                </a>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
