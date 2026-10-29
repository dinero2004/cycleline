import data from "./sample-routes.json";
import type { RideProfile, Route } from "@/lib/routing/types";

export interface SampleRoute {
  slug: string;
  name: string;
  startName: string;
  endName: string;
  profile: RideProfile;
  image: string;
  source: string;
  route: Route;
}

/** Real BRouter routes captured by scripts/build-sample-routes.ts. */
export const SAMPLE_ROUTES = data as unknown as SampleRoute[];
