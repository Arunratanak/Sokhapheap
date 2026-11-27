"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L, { type LatLngBoundsExpression } from "leaflet";
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { colourFor, type AreaProps, type LayerDef } from "@/domain/insights/layers";
import { TYPE_STYLE, type FacilityItem } from "@/components/features/map/FacilityList";

const CAMBODIA: LatLngBoundsExpression = [[10.4, 102.3], [14.7, 107.7]];

function FitSelected({ data, selected }: { data: FeatureCollection<Geometry, AreaProps>; selected: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!selected) return;
    const f = data.features.find((x) => x.properties.pcode === selected);
    if (!f) return;
    const b = L.geoJSON(f as Feature).getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [24, 24], maxZoom: 11 });
  }, [data, selected, map]);
  return null;
}

export default function ChoroplethMap({
  data, layer, breaks, selected, onSelect, facilities, ariaLabel, label,
}: {
  data: FeatureCollection<Geometry, AreaProps>;
  layer: LayerDef;
  breaks: number[];
  selected: string | null;
  onSelect: (pcode: string) => void;
  facilities: FacilityItem[];
  ariaLabel: string;
  label: (p: AreaProps) => string;
}) {
  // Re-create the GeoJSON layer when the data, layer or selection changes (styles are baked in).
  const key = useMemo(() => `${data.features.length}:${layer.id}:${selected}:${breaks.join(",")}`, [data, layer, selected, breaks]);

  return (
    <div className="h-[55vh] min-h-72 w-full overflow-hidden rounded-2xl border border-border lg:h-136" role="region" aria-label={ariaLabel}>
      <MapContainer bounds={CAMBODIA} preferCanvas scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.5}
        />
        <GeoJSON
          key={key}
          data={data}
          style={(f) => {
            const p = f?.properties as AreaProps;
            const isSel = p?.pcode === selected;
            return {
              fillColor: colourFor(layer.get(p), breaks, layer.lowIsWorse),
              fillOpacity: 0.8,
              color: isSel ? "#0e0d0b" : "#ffffff",
              weight: isSel ? 3 : 0.6,
            };
          }}
          onEachFeature={(f, l) => {
            const p = f.properties as AreaProps;
            l.on("click", () => onSelect(p.pcode));
            l.bindTooltip(label(p), { sticky: true });
          }}
        />
        {facilities.map((f) => (
          <CircleMarker
            key={f.id}
            center={[f.lat, f.lng]}
            radius={f.type === "hospital" ? 7 : 5}
            pathOptions={{ color: "#0e0d0b", weight: 1.5, fillColor: TYPE_STYLE[f.type].color, fillOpacity: 1 }}
          >
            <Tooltip>{f.name}</Tooltip>
          </CircleMarker>
        ))}
        <FitSelected data={data} selected={selected} />
      </MapContainer>
    </div>
  );
}
