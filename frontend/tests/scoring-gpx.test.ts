import { describe, expect, it } from "vitest";
import fixture from "./fixtures/brouter-zurich-baden.json";
import { buildGpx, escapeXml, gpxFileName } from "@/lib/routing/gpx";
import { parseBRouter } from "@/lib/routing/providers/brouter";
import { dedupeRoutes, rankRoutes } from "@/lib/routing/scoring";
import type { Route } from "@/lib/routing/types";

const base = parseBRouter(
  fixture as never,
  { waypoints: [[47.3846, 8.5313], [47.4733, 8.3065]], profile: "commuter", preferences: {}, alternative: 0 },
  "t",
);
const variant = (patch: Partial<Route>): Route => ({ ...base, ...patch });

describe("candidate scoring", () => {
  it("prefers the candidate under the rider's max grade", () => {
    const steep = variant({ id: "steep", maxGradePct: 12 });
    const gentle = variant({ id: "gentle", maxGradePct: 5, distanceM: base.distanceM + 2000 });
    const [first, second] = rankRoutes([steep, gentle], { fitness: "intermediate", preferences: { maxGradePct: 8 } });
    expect(first.id).toBe("gentle");
    expect(second.why).toMatch(/above your 8% limit/);
  });

  it("prefers paved routes when asked", () => {
    const gravelly = variant({ id: "g", surfaceMix: { paved: base.distanceM * 0.4, gravel: base.distanceM * 0.6, trail: 0, unknown: 0 } });
    const paved = variant({ id: "p", surfaceMix: { paved: base.distanceM, gravel: 0, trail: 0, unknown: 0 } });
    expect(rankRoutes([gravelly, paved], { fitness: "beginner", preferences: { surface: "paved" } })[0].id).toBe("p");
  });

  it("ranks loops by closeness to the target distance", () => {
    const near = variant({ id: "near", distanceM: 41_000 });
    const far = variant({ id: "far", distanceM: 55_000 });
    const ranked = rankRoutes([far, near], { fitness: "strong", preferences: {}, targetDistanceM: 40_000 });
    expect(ranked[0].id).toBe("near");
    expect(ranked[0].why).toMatch(/closest to your 40 km/i);
  });

  it("drops near-identical candidates", () => {
    expect(dedupeRoutes([base, variant({ id: "same", distanceM: base.distanceM + 50 })])).toHaveLength(1);
    expect(dedupeRoutes([base, variant({ id: "other", distanceM: base.distanceM + 3000 })])).toHaveLength(2);
  });
});

describe("GPX", () => {
  const gpx = buildGpx({
    name: 'Tom & "Jerry" <loop>',
    coordinates: [
      [8.5, 47.3, 400],
      [8.51, 47.31, 410.25],
    ],
    waypoints: [{ point: [47.3, 8.5], name: "Café <stop>" }],
    watermark: "guest",
    time: new Date("2026-01-01T00:00:00Z"),
  });

  it("escapes names and waypoint labels", () => {
    expect(gpx).toContain("<name>Tom &amp; &quot;Jerry&quot; &lt;loop&gt;</name>");
    expect(gpx).toContain("<name>Café &lt;stop&gt;</name>");
    expect(escapeXml("a'b")).toBe("a&apos;b");
  });

  it("writes lat/lon in the right order with elevation", () => {
    expect(gpx).toContain('<trkpt lat="47.310000" lon="8.510000"><ele>410.3</ele></trkpt>');
    expect(gpx).toContain('<wpt lat="47.300000" lon="8.500000">');
  });

  it("is well-formed: every opened element is closed", () => {
    const opened = (gpx.match(/<(gpx|metadata|trk|trkseg|trkpt|wpt)[ >]/g) ?? []).length;
    const closed = (gpx.match(/<\/(gpx|metadata|trk|trkseg|trkpt|wpt)>/g) ?? []).length;
    expect(opened).toBe(closed);
    expect(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it("adds the watermark to the description and makes safe file names", () => {
    expect(gpx).toContain("<desc>guest</desc>");
    expect(gpxFileName("Tom & Jerry's loop!")).toBe("tom-jerry-s-loop.gpx");
    expect(gpxFileName("!!!")).toBe("cycleline-route.gpx");
  });

  it("accepts plain [lat, lng] points without elevation", () => {
    expect(buildGpx({ name: "x", coordinates: [[47.3, 8.5], [47.4, 8.6]] })).toContain('<trkpt lat="47.300000" lon="8.500000"></trkpt>');
  });
});
