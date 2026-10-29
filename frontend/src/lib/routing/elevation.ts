import { haversineM } from "./metrics";
import { RoutingError, type LatLng } from "./types";

const OPEN_METEO = process.env.ELEVATION_URL ?? "https://api.open-meteo.com/v1/elevation";
const BATCH = 100; // Open-Meteo's per-request limit

/** `count` evenly spaced points along a line (by distance), first and last included; densifies short input. */
export function resample(points: LatLng[], count: number): LatLng[] {
  if (points.length < 2 || count < 2) return points;
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversineM(points[i - 1], points[i]));
  const total = cum[cum.length - 1];
  const out: LatLng[] = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const d = (total * k) / (count - 1);
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const t = (d - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    const [a, b] = [points[j], points[j + 1]];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

/** Elevations (m) for points via Open-Meteo (Copernicus 90 m DEM, free, no key). */
export async function lookupElevations(points: LatLng[], signal?: AbortSignal): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH);
    const url = new URL(OPEN_METEO);
    url.searchParams.set("latitude", batch.map((p) => p[0].toFixed(5)).join(","));
    url.searchParams.set("longitude", batch.map((p) => p[1].toFixed(5)).join(","));
    const response = await fetch(url, { signal, cache: "no-store" });
    if (!response.ok) throw new RoutingError("provider_unavailable", `Elevation service answered ${response.status}.`);
    const data = (await response.json()) as { elevation?: number[] };
    if (!data.elevation || data.elevation.length !== batch.length) {
      throw new RoutingError("provider_unavailable", "The elevation service returned an incomplete profile.");
    }
    out.push(...data.elevation);
  }
  return out;
}
