import { rideProfileForBike } from "@/lib/api";
import { encodeShare } from "@/lib/studio";
import type { SavedRoute } from "@/types";

/** Opens a saved route in Route Studio with its waypoints, ride profile and name. */
export function plannerHref(route: SavedRoute): string {
  const points = route.details?.waypoints ?? [
    [route.start_lat, route.start_lng],
    [route.end_lat, route.end_lng],
  ];
  return `/planner?${encodeShare(
    points.map((point, i) => ({ id: String(i), point })),
    route.details?.ride_profile ?? rideProfileForBike(route.profile),
    route.name,
  )}`;
}
