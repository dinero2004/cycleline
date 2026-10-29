/**
 * Fetches real routes from BRouter and stores them as src/data/sample-routes.json.
 * The home page and the guest demo's first route use them, so nothing on those screens is invented.
 * Run: npx tsx scripts/build-sample-routes.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createBRouter } from "../src/lib/routing/providers/brouter";
import { simplifyRoute } from "../src/lib/routing/simplify";
import type { LatLng, RideProfile } from "../src/lib/routing/types";

const samples: {
  slug: string;
  name: string;
  startName: string;
  endName: string;
  profile: RideProfile;
  image: string;
  waypoints: LatLng[];
}[] = [
  {
    slug: "pfannenstiel-gravel",
    name: "Pfannenstiel gravel ride",
    startName: "Zürich, Bellevue",
    endName: "Meilen station",
    profile: "gravel",
    image: "/images/cycling/gravel-forest.png",
    waypoints: [[47.3667, 8.545], [47.2965, 8.6733], [47.2697, 8.6436]],
  },
  {
    slug: "albis-road",
    name: "Albis pass road climb",
    startName: "Zürich, Wiedikon",
    endName: "Zug",
    profile: "road",
    image: "/images/cycling/alpine-riders.png",
    waypoints: [[47.3713, 8.5197], [47.278, 8.5223], [47.173, 8.515]],
  },
  {
    slug: "limmat-commute",
    name: "Limmat valley commute",
    startName: "Zürich, Limmatplatz",
    endName: "Baden",
    profile: "commuter",
    image: "/images/cycling/city-community.png",
    waypoints: [[47.3846, 8.5313], [47.4733, 8.3065]],
  },
];

async function main() {
  const brouter = createBRouter();
  const out = [];
  for (const sample of samples) {
    const route = await brouter.route(
      { waypoints: sample.waypoints, profile: sample.profile, preferences: {}, alternative: 0 },
      AbortSignal.timeout(30_000),
    );
    const { waypoints, ...meta } = sample;
    void waypoints;
    out.push({
      ...meta,
      source: `BRouter (brouter.de), fetched ${new Date().toISOString().slice(0, 10)}`,
      route: simplifyRoute(route, 8),
    });
    console.log(
      `${sample.name}: ${(route.distanceM / 1000).toFixed(1)} km, +${route.ascentM} m, ` +
        `${route.geometry.coordinates.length} → ${out[out.length - 1].route.geometry.coordinates.length} points`,
    );
  }
  writeFileSync(join(__dirname, "../src/data/sample-routes.json"), `${JSON.stringify(out)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
