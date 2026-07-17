"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

function FitRoute({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates.length > 1) {
      map.fitBounds(coordinates, { padding: [48, 48] });
    }
  }, [coordinates, map]);

  return null;
}

export default function PlannerMap({ coordinates }: { coordinates: [number, number][] }) {
  const route = coordinates.length > 1 ? coordinates : [[47.3769, 8.5417] as [number, number]];
  const start = route[0];
  const end = route[route.length - 1];

  return (
    <MapContainer center={start} zoom={11} zoomControl={false} className="planner-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {coordinates.length > 1 && (
        <>
          <Polyline positions={coordinates} pathOptions={{ color: "#d9ff43", weight: 6, opacity: 0.95 }} />
          <Polyline positions={coordinates} pathOptions={{ color: "#152017", weight: 2, opacity: 0.7 }} />
          <CircleMarker center={start} radius={7} pathOptions={{ color: "#f7f4ec", fillColor: "#152017", fillOpacity: 1 }}>
            <Tooltip direction="top">Start</Tooltip>
          </CircleMarker>
          <CircleMarker center={end} radius={7} pathOptions={{ color: "#152017", fillColor: "#ff6b45", fillOpacity: 1 }}>
            <Tooltip direction="top">Finish</Tooltip>
          </CircleMarker>
          <FitRoute coordinates={coordinates} />
        </>
      )}
    </MapContainer>
  );
}
