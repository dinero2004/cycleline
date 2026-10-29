import { cumulativeDistances } from "@/lib/routing/metrics";
import type { Route } from "@/lib/routing/types";
import { projector } from "./route-shape";

/** Route drawn in surface colours (paved, gravel, trail, unknown) with numbered waypoint markers. */
export function SurfaceRouteShape({
  route,
  width = 400,
  height = 240,
  label,
}: {
  route: Pick<Route, "geometry" | "segments" | "waypoints">;
  width?: number;
  height?: number;
  label: string;
}) {
  const coordinates = route.geometry.coordinates;
  if (coordinates.length < 2) return null;
  const project = projector(coordinates, width, height, 22);
  const distances = cumulativeDistances(coordinates);
  const total = distances[distances.length - 1] || 1;
  // Segment distances come from the full line; rescale to this (possibly simplified) one.
  const segTotal = route.segments[route.segments.length - 1]?.endM || total;
  const k = total / segTotal;

  const pieces = route.segments.map((s) => {
    const pts = coordinates.filter((_, i) => distances[i] >= s.startM * k - 1 && distances[i] <= s.endM * k + 1);
    return { surface: s.surface, points: pts.map(([lng, lat]) => project([lat, lng]).join(",")).join(" ") };
  });

  return (
    <svg className="route-shape surface-route" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <polyline
        className="route-shadow"
        points={coordinates.map(([lng, lat]) => project([lat, lng]).join(",")).join(" ")}
      />
      {pieces.map((p, i) => (
        <polyline key={i} className={`route-surface surface-stroke-${p.surface}`} points={p.points} />
      ))}
      {route.waypoints.map(([lat, lng], i) => {
        const [x, y] = project([lat, lng]);
        return (
          <g key={i} className="waypoint-pin" transform={`translate(${x} ${y})`}>
            <rect x="-9" y="-9" width="18" height="18" />
            <text y="4.5">{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}
