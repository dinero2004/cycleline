import type { Surface } from "./types";

const PAVED = new Set([
  "asphalt", "paved", "concrete", "concrete:plates", "concrete:lanes", "paving_stones", "sett",
  "cobblestone", "unhewn_cobblestone", "chipseal", "metal", "wood",
]);
const GRAVEL = new Set(["gravel", "fine_gravel", "compacted", "unpaved", "pebblestone", "shells"]);
const TRAIL = new Set(["dirt", "ground", "earth", "grass", "mud", "sand", "woodchips", "rock", "grass_paver"]);

/** Road classes that are paved unless tagged otherwise (an inference, reported as such). */
const PAVED_ROADS = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential",
  "living_street", "service", "cycleway", "motorway_link", "trunk_link", "primary_link",
  "secondary_link", "tertiary_link",
]);

/** Parses BRouter-style "key=value key=value" way tags. */
export function parseTags(raw: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const pair of raw.split(" ")) {
    const eq = pair.indexOf("=");
    if (eq > 0) tags[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return tags;
}

/** Surface bucket from OSM surface, tracktype and highway tags. */
export function classifySurface(tags: Record<string, string>): { surface: Surface; inferred: boolean } {
  const surface = tags.surface;
  if (surface) {
    if (PAVED.has(surface)) return { surface: "paved", inferred: false };
    if (GRAVEL.has(surface)) return { surface: "gravel", inferred: false };
    if (TRAIL.has(surface)) return { surface: "trail", inferred: false };
  }
  const track = tags.tracktype;
  if (track === "grade1") return { surface: "paved", inferred: true };
  if (track === "grade2" || track === "grade3") return { surface: "gravel", inferred: true };
  if (track === "grade4" || track === "grade5") return { surface: "trail", inferred: true };
  if (tags.highway && PAVED_ROADS.has(tags.highway)) return { surface: "paved", inferred: true };
  return { surface: "unknown", inferred: false };
}

/** Main roads where traffic is likely heavy, unless a cycleway runs alongside. */
export function isBusyRoad(tags: Record<string, string>): boolean {
  if (!["trunk", "primary", "secondary", "trunk_link", "primary_link"].includes(tags.highway ?? "")) return false;
  return !hasCycleway(tags);
}

export function hasCycleway(tags: Record<string, string>): boolean {
  if (tags.highway === "cycleway") return true;
  return Object.entries(tags).some(
    ([key, value]) => key.startsWith("cycleway") && !key.includes("oneway") && value !== "no" && value !== "separate",
  );
}
