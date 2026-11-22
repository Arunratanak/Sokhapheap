"use client";

import type { Dictionary, Locale } from "@/lib/i18n";
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

export const TYPE_STYLE: Record<FacilityItem["type"], { color: string; icon: string }> = {
  hospital: { color: "#c0262d", icon: "🏥" },
  health_centre: { color: "#0f766e", icon: "➕" },
  health_post: { color: "#7c3aed", icon: "⛑️" },
  clinic: { color: "#1d4ed8", icon: "🩺" },
  other: { color: "#57534e", icon: "📍" },
};

export function directionsUrl(f: { lat: number; lng: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`;
}

export function FacilityList({ items, lang, t }: { items: FacilityItem[]; lang: Locale; t: Dictionary }) {
  if (!items.length) return <p className="text-muted">{t.map.noResults}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((f) => {
        const s = TYPE_STYLE[f.type];
        const name = lang === "km" && f.name_km ? f.name_km : f.name;
        return (
          <li key={f.id} className="rounded-xl border border-black/10 bg-surface p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span aria-hidden className="mt-0.5 text-xl">{s.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{name}</p>
                <p className="text-sm text-muted">
                  <span style={{ color: s.color }} className="font-medium">{t.map.types[f.type]}</span>
                  {" · "}
                  {[f.district, f.province].filter(Boolean).join(", ")}
                  {f.distance_m !== undefined && <> · {fmtClient(t.map.distanceKm, { km: formatKm(f.distance_m, lang) }, lang)}</>}
                </p>
                <a
                  href={directionsUrl(f)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-brand-soft px-3 text-sm font-semibold text-brand-strong hover:bg-brand hover:text-white"
                >
                  🧭 {t.map.directions}
                </a>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
