import type { LatLng, RideProfile, Route, RoutePreferences } from "../types";

export interface ProviderRequest {
  waypoints: LatLng[];
  profile: RideProfile;
  preferences: RoutePreferences;
  /** 0 = best route; 1–3 ask the provider for alternatives where supported. */
  alternative: number;
}

export interface RoutingProvider {
  readonly name: string;
  /** False when a required API key or URL is missing; the service skips it. */
  isConfigured(): boolean;
  /** Highest alternative index this provider understands (0 = none). */
  readonly maxAlternative: number;
  route(request: ProviderRequest, signal: AbortSignal): Promise<Route>;
}
