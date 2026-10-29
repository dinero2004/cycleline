"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useTheme } from "@/components/theme-toggle";
import { distanceAtPoint, pointAtDistance } from "@/lib/routing/metrics";
import { simplifyLine } from "@/lib/routing/simplify";
import type { LatLng, Route } from "@/lib/routing/types";
import type { Waypoint } from "@/lib/studio";

export type MapLayer = "map" | "topo";

const TILES = {
  light: {
    url: process.env.NEXT_PUBLIC_TILES_LIGHT ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  // No free keyless dark raster basemap is reliable, so by default dark mode filters the standard
  // OSM tiles (see .tiles-darkened). NEXT_PUBLIC_TILES_DARK switches to a real dark tile set.
  dark: {
    url: process.env.NEXT_PUBLIC_TILES_DARK ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  },
};

function waypointIcon(index: number, count: number) {
  const kind = index === 0 ? "start" : index === count - 1 ? "finish" : "via";
  const html = kind === "via" ? `<span>${index + 1}</span>` : "<span></span>";
  return L.divIcon({ className: `wp-icon wp-${kind}`, html, iconSize: [30, 30], iconAnchor: [15, 15] });
}

/** Map clicks (draw mode) and long-press (always) add a waypoint. */
function MapInput({ draw, onAdd }: { draw: boolean; onAdd: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      if (draw) onAdd([event.latlng.lat, event.latlng.lng]);
    },
    // Leaflet fires contextmenu on long-press on touch screens and on right-click with a mouse.
    contextmenu(event) {
      event.originalEvent.preventDefault();
      onAdd([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

/** Fits the view when fitKey changes (new route from search, alternatives or the assistant), not while drawing. */
function FitTo({ fitKey, coordinates, bottomInset }: { fitKey: string; coordinates: LatLng[]; bottomInset: number }) {
  const map = useMap();
  useEffect(() => {
    // Keep the route clear of the toolbar on top and the elevation panel or sheet at the bottom.
    if (coordinates.length > 1) map.fitBounds(coordinates, { paddingTopLeft: [48, 84], paddingBottomRight: [48, bottomInset] });
    else if (coordinates.length === 1) map.setView(coordinates[0], Math.max(map.getZoom(), 13));
    // Only refit when the key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

function Ready({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => onReady(map), [map, onReady]);
  return null;
}

export default function StudioMap({
  waypoints,
  route,
  pending,
  draw,
  layer,
  activeD,
  fitKey,
  bottomInset,
  onActiveChange,
  onAdd,
  onMove,
  onReady,
}: {
  waypoints: Waypoint[];
  route: Route | null;
  pending: boolean;
  draw: boolean;
  layer: MapLayer;
  activeD: number | null;
  fitKey: string;
  /** Pixels covered at the bottom (elevation panel or bottom sheet). */
  bottomInset: number;
  onActiveChange: (d: number | null) => void;
  onAdd: (point: LatLng) => void;
  onMove: (id: string, point: LatLng) => void;
  onReady: (map: L.Map) => void;
}) {
  const theme = useTheme();
  const tiles = layer === "topo" ? TILES.topo : TILES[theme];
  // Long routes are thinned (3 m tolerance) before drawing; metrics still come from the full line.
  const line = useMemo<LatLng[]>(() => {
    const coordinates = route?.geometry.coordinates ?? [];
    return (coordinates.length > 1500 ? simplifyLine(coordinates, 3) : coordinates).map(([lng, lat]) => [lat, lng]);
  }, [route]);
  const points = waypoints.map((w) => w.point);
  const active = route && activeD !== null ? pointAtDistance(route, activeD) : null;
  const center: LatLng = points[0] ?? [47.3769, 8.5417];
  const fitCoordinates = line.length > 1 ? line : points;

  return (
    <MapContainer
      center={center}
      zoom={12}
      zoomControl={false}
      className={`studio-map${draw ? " is-drawing" : ""}${theme === "dark" && layer === "map" && !process.env.NEXT_PUBLIC_TILES_DARK ? " tiles-darkened" : ""}`}
      keyboard
      attributionControl
    >
      <TileLayer key={`${layer}-${theme}`} url={tiles.url} attribution={tiles.attribution} maxZoom={19} detectRetina />
      <MapInput draw={draw} onAdd={onAdd} />
      <FitTo fitKey={fitKey} coordinates={fitCoordinates} bottomInset={bottomInset} />
      <Ready onReady={onReady} />

      {/* While a route is being snapped, show the straight line through the waypoints. */}
      {pending && points.length > 1 && <Polyline positions={points} pathOptions={{ className: "map-optimistic", interactive: false }} />}

      {line.length > 1 && (
        <>
          <Polyline positions={line} pathOptions={{ className: "map-route-shadow", interactive: false }} />
          <Polyline
            positions={line}
            pathOptions={{ className: `map-route-line${pending ? " is-stale" : ""}` }}
            eventHandlers={{
              mousemove: (event) => route && onActiveChange(distanceAtPoint(route, [event.latlng.lat, event.latlng.lng])),
              mouseout: () => onActiveChange(null),
            }}
          />
        </>
      )}

      {waypoints.map((w, i) => (
        <Marker
          key={w.id}
          position={w.point}
          icon={waypointIcon(i, waypoints.length)}
          draggable
          keyboard={false}
          title={i === 0 ? "Start" : i === waypoints.length - 1 ? "Finish" : `Waypoint ${i + 1}`}
          eventHandlers={{
            dragend: (event) => {
              const { lat, lng } = (event.target as L.Marker).getLatLng();
              onMove(w.id, [lat, lng]);
            },
          }}
        />
      ))}

      {active && <CircleMarker center={active} radius={7} pathOptions={{ className: "map-position", interactive: false }} />}
    </MapContainer>
  );
}
