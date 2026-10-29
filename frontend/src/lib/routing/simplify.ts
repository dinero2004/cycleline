import type { Position, Route } from "./types";

/** Perpendicular distance in metres from p to the segment a–b (equirectangular, fine at route scale). */
function offsetM(p: Position, a: Position, b: Position): number {
  const k = Math.cos((a[1] * Math.PI) / 180) * 111_320;
  const [px, py] = [p[0] * k, p[1] * 110_540];
  const [ax, ay] = [a[0] * k, a[1] * 110_540];
  const [bx, by] = [b[0] * k, b[1] * 110_540];
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Douglas–Peucker on the line; keeps vertices that bend more than toleranceM. Iterative to avoid deep recursion. */
export function simplifyLine(points: Position[], toleranceM: number): Position[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let index = -1;
    let max = toleranceM;
    for (let i = first + 1; i < last; i++) {
      const d = offsetM(points[i], points[first], points[last]);
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Lighter copy of a route for drawing and storage; distances and metrics stay as computed on the full line. */
export function simplifyRoute<T extends Pick<Route, "geometry">>(route: T, toleranceM = 5): T {
  return { ...route, geometry: { type: "LineString", coordinates: simplifyLine(route.geometry.coordinates, toleranceM) } };
}
