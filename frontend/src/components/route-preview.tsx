import type { SavedRoute } from "@/types";

function linePoints(coordinates: [number, number][]) {
  if (coordinates.length < 2) return "8,44 152,44";

  const lats = coordinates.map(([lat]) => lat);
  const lngs = coordinates.map(([, lng]) => lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;

  return coordinates
    .filter((_, index) => index % Math.max(1, Math.floor(coordinates.length / 70)) === 0)
    .map(([lat, lng]) => {
      const x = 10 + ((lng - minLng) / lngRange) * 140;
      const y = 72 - ((lat - minLat) / latRange) * 62;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function RoutePreview({
  route,
  accent = "acid",
}: {
  route: Pick<SavedRoute, "coordinates">;
  accent?: "acid" | "coral" | "blue";
}) {
  return (
    <svg className={`route-preview ${accent}`} viewBox="0 0 160 82" role="img" aria-label="Route shape preview">
      <path d="M0 68 C34 47 49 73 78 48 S125 17 160 32" />
      <polyline points={linePoints(route.coordinates)} />
      <circle cx="10" cy="72" r="4" />
    </svg>
  );
}
