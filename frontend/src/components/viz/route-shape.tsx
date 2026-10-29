import type { LatLng, Position } from "@/lib/routing/types";

/** Projects lng/lat into a w×h box, keeping the aspect ratio (equirectangular, fine at route scale). */
export function projector(coordinates: Position[], width: number, height: number, pad = 16) {
  const lngs = coordinates.map((c) => c[0]);
  const lats = coordinates.map((c) => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (maxLng - minLng) * k || 1e-6;
  const spanY = maxLat - minLat || 1e-6;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return ([lat, lng]: LatLng): [number, number] => [offX + (lng - minLng) * k * scale, height - offY - (lat - minLat) * scale];
}

/** Route line with a contrasting shadow stroke, ring-and-dot start and finish markers, optional position marker. */
export function RouteShape({
  coordinates,
  width = 320,
  height = 200,
  marker,
  label,
  className = "",
}: {
  coordinates: Position[];
  width?: number;
  height?: number;
  marker?: LatLng | null;
  label?: string;
  className?: string;
}) {
  if (coordinates.length < 2) return null;
  const project = projector(coordinates, width, height);
  const points = coordinates.map(([lng, lat]) => project([lat, lng]).map((n) => n.toFixed(1)).join(",")).join(" ");
  const [sx, sy] = project([coordinates[0][1], coordinates[0][0]]);
  const last = coordinates[coordinates.length - 1];
  const [ex, ey] = project([last[1], last[0]]);
  const m = marker ? project(marker) : null;

  return (
    <svg
      className={`route-shape ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      preserveAspectRatio="xMidYMid meet"
    >
      <polyline className="route-shadow" points={points} />
      <polyline className="route-line" points={points} />
      <g className="route-marker start" transform={`translate(${sx} ${sy})`}>
        <circle r="7" />
        <circle r="2.6" />
      </g>
      <g className="route-marker finish" transform={`translate(${ex} ${ey})`}>
        <circle r="7" />
        <circle r="2.6" />
      </g>
      {m && <circle className="route-position" cx={m[0]} cy={m[1]} r="5" />}
    </svg>
  );
}
