/** Normalized route model shared by every routing provider, the API and the UI. */

export type RideProfile = "road" | "gravel" | "mtb" | "ebike" | "commuter";
export type Fitness = "beginner" | "intermediate" | "strong";
export type Surface = "paved" | "gravel" | "trail" | "unknown";
export type SurfacePreference = "paved" | "mixed" | "gravel";

/** [lat, lng] as used by Leaflet and the rest of the app. */
export type LatLng = [number, number];
/** GeoJSON position: [lng, lat, elevation m]. */
export type Position = [number, number, number];

export interface RoutePreferences {
  maxGradePct?: number;
  avoidHighways?: boolean;
  preferCycleways?: boolean;
  surface?: SurfacePreference;
  minimizeTraffic?: boolean;
  /** 0 = fastest, 1 = most scenic; nudges candidate ranking only. */
  scenic?: number;
}

export interface RouteSegment {
  /** Distance from the start, metres. */
  startM: number;
  endM: number;
  surface: Surface;
  /** True when the surface comes from the road class, not an explicit surface tag. */
  surfaceInferred: boolean;
  surfaceTag?: string;
  highway?: string;
  gradePct: number;
  cycleway: boolean;
}

export type WarningKind = "steep" | "unpaved" | "busy_road";

export interface RouteWarning {
  kind: WarningKind;
  message: string;
  startM: number;
  endM: number;
}

export interface ElevationPoint {
  /** Distance from the start, metres. */
  d: number;
  /** Elevation, metres. */
  e: number;
}

export interface Route {
  id: string;
  provider: string;
  profile: RideProfile;
  waypoints: LatLng[];
  geometry: { type: "LineString"; coordinates: Position[] };
  distanceM: number;
  ascentM: number;
  descentM: number;
  /** The provider's own time estimate, seconds. The UI uses estimateDuration() by fitness. */
  providerDurationS: number | null;
  maxGradePct: number;
  avgGradePct: number;
  /** Elevation profile from the full-resolution line (charts use this, not the simplified geometry). */
  elevation: ElevationPoint[];
  segments: RouteSegment[];
  /** Metres per surface bucket. */
  surfaceMix: Record<Surface, number>;
  /** Metres whose surface was inferred from the road class rather than tagged. */
  inferredSurfaceM: number;
  warnings: RouteWarning[];
}

export interface RankedRoute extends Route {
  score: number;
  why: string;
}

export type RoutingErrorCode =
  | "invalid_request"
  | "no_route"
  | "too_long"
  | "rate_limited"
  | "provider_unavailable"
  | "timeout";

export class RoutingError extends Error {
  constructor(
    public readonly code: RoutingErrorCode,
    message: string,
    public readonly status = code === "invalid_request" || code === "too_long" ? 422 : code === "rate_limited" ? 429 : code === "no_route" ? 404 : 502,
  ) {
    super(message);
  }
}

export const SURFACES: Surface[] = ["paved", "gravel", "trail", "unknown"];
