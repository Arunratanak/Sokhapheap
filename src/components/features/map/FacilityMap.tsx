"use client";

import { API_BASE } from "@/lib/client/api-base";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import { TYPE_STYLE, type FacilityItem } from "@/components/features/map/FacilityList";

type Row = [number, number, number, string, string];
const CAMBODIA: LatLngBoundsExpression = [[10.4, 102.3], [14.7, 107.7]];

function FitTo({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  }, [bounds, map]);
  return null;
}

export default function FacilityMap({
  focus, user, lang, ariaLabel,
}: {
  focus: FacilityItem[];
  user: { lat: number; lng: number } | null;
  lang: "km" | "en";
  ariaLabel: string;
}) {
  const [data, setData] = useState<{ types: FacilityItem["type"][]; rows: Row[] } | null>(null);

  useEffect(() => {
    // Only fetched once the user taps "Show map" (keeps the first load light on slow 3G).
    fetch(API_BASE + "/api/facilities/all").then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  const pts = [...focus.map((f) => [f.lat, f.lng] as [number, number]), ...(user ? [[user.lat, user.lng] as [number, number]] : [])];
  const bounds: LatLngBoundsExpression | null = pts.length ? (pts as LatLngBoundsExpression) : null;
  const focusIds = new Set(focus.map((f) => `${f.lat},${f.lng}`));

  return (
    <div className="h-80 w-full overflow-hidden rounded-2xl border border-line sm:h-96" role="region" aria-label={ariaLabel}>
      <MapContainer bounds={CAMBODIA} preferCanvas scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {data?.rows.map(([lat, lng, ti, name, nameKm], i) => {
          const type = data.types[ti];
          const highlighted = focusIds.has(`${lat},${lng}`);
          return (
            <CircleMarker
              key={i}
              center={[lat, lng]}
              radius={highlighted ? 9 : type === "hospital" ? 6 : 4}
              pathOptions={{ color: highlighted ? "#111" : "#fff", weight: highlighted ? 2 : 1, fillColor: TYPE_STYLE[type].color, fillOpacity: 0.9 }}
            >
              <Tooltip>{lang === "km" && nameKm ? nameKm : name}</Tooltip>
            </CircleMarker>
          );
        })}
        {user && (
          <CircleMarker center={[user.lat, user.lng]} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}>
            <Tooltip permanent direction="top">📍</Tooltip>
          </CircleMarker>
        )}
        <FitTo bounds={bounds} />
      </MapContainer>
    </div>
  );
}
