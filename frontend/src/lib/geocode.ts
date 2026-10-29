import "server-only";

import { TtlCache } from "@/lib/cache";
import { RoutingError } from "@/lib/routing/types";

interface NominatimPlace {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  type?: string;
}

export interface Place {
  name: string;
  label: string;
  coordinates: [number, number];
  type?: string;
}

const cache = new TtlCache<Place[]>(1000, 24 * 60 * 60 * 1000);

export async function searchPlaces(query: string, limit: number, signal?: AbortSignal): Promise<Place[]> {
  const key = `${query.toLowerCase()}|${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const url = new URL(process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json", "Accept-Language": "en", "User-Agent": "CycleLine/3.0 route planner" },
    cache: "no-store",
  });
  if (!response.ok) throw new RoutingError("provider_unavailable", "The place search is unavailable.");
  const places = ((await response.json()) as NominatimPlace[]).map((p) => ({
    name: p.name || p.display_name.split(",")[0],
    label: p.display_name,
    coordinates: [Number(p.lat), Number(p.lon)] as [number, number],
    type: p.type,
  }));
  cache.set(key, places);
  return places;
}
