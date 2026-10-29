import { describe, expect, it } from "vitest";
import fixture from "./fixtures/brouter-zurich-baden.json";
import {
  ascentDescent,
  buildRoute,
  difficulty,
  estimateDurationS,
  speedKmh,
  surfacePercentages,
} from "@/lib/routing/metrics";
import { parseBRouter, brouterProfile } from "@/lib/routing/providers/brouter";
import { classifySurface, isBusyRoad, parseTags } from "@/lib/routing/surface";
import type { Position, Route } from "@/lib/routing/types";

const request = {
  waypoints: [[47.3846, 8.5313], [47.4733, 8.3065]] as [number, number][],
  profile: "commuter" as const,
  preferences: {},
  alternative: 0,
};

describe("surface classification", () => {
  it("uses the surface tag first", () => {
    expect(classifySurface(parseTags("highway=track surface=asphalt"))).toEqual({ surface: "paved", inferred: false });
    expect(classifySurface(parseTags("highway=track surface=fine_gravel"))).toEqual({ surface: "gravel", inferred: false });
    expect(classifySurface(parseTags("highway=path surface=ground"))).toEqual({ surface: "trail", inferred: false });
  });

  it("falls back to tracktype, then road class, and marks it inferred", () => {
    expect(classifySurface(parseTags("highway=track tracktype=grade2"))).toEqual({ surface: "gravel", inferred: true });
    expect(classifySurface(parseTags("highway=residential"))).toEqual({ surface: "paved", inferred: true });
  });

  it("reports untagged paths honestly as unknown", () => {
    expect(classifySurface(parseTags("highway=path"))).toEqual({ surface: "unknown", inferred: false });
  });

  it("flags main roads without a cycle lane as busy", () => {
    expect(isBusyRoad(parseTags("highway=primary"))).toBe(true);
    expect(isBusyRoad(parseTags("highway=primary cycleway:right=lane"))).toBe(false);
    expect(isBusyRoad(parseTags("highway=primary cycleway:both=no"))).toBe(true);
    expect(isBusyRoad(parseTags("highway=residential"))).toBe(false);
  });
});

describe("BRouter adapter (real Zürich → Baden response)", () => {
  const route = parseBRouter(fixture as never, request, "trekking:0");

  it("keeps geometry with elevation and matches BRouter's distance", () => {
    expect(route.geometry.coordinates[0]).toHaveLength(3);
    expect(Math.abs(route.distanceM - 22713)).toBeLessThan(22713 * 0.02);
  });

  it("splits the route into segments that cover the whole distance", () => {
    expect(route.segments[0].startM).toBe(0);
    expect(route.segments[route.segments.length - 1].endM).toBe(route.distanceM);
    const mix = Object.values(route.surfaceMix).reduce((a, b) => a + b, 0);
    expect(Math.abs(mix - route.distanceM)).toBeLessThanOrEqual(route.segments.length);
  });

  it("finds paved surface along the Limmat", () => {
    expect(route.surfaceMix.paved / route.distanceM).toBeGreaterThan(0.5);
  });

  it("gives a stable id for the same request", () => {
    expect(parseBRouter(fixture as never, request, "trekking:0").id).toBe(route.id);
    expect(parseBRouter(fixture as never, request, "trekking:1").id).not.toBe(route.id);
  });
});

describe("profiles", () => {
  it("maps ride profiles and preferences to BRouter profiles", () => {
    expect(brouterProfile("road", {})).toBe("fastbike");
    expect(brouterProfile("road", { minimizeTraffic: true })).toBe("fastbike-verylowtraffic");
    expect(brouterProfile("gravel", {})).toBe("gravel");
    expect(brouterProfile("gravel", { surface: "paved" })).toBe("trekking");
    expect(brouterProfile("commuter", { preferCycleways: true })).toBe("safety");
  });
});

function straightRoute(points: number, metresPerStep: number, rise: number[]): Position[] {
  // Due north from Zürich; 1° latitude ≈ 111.2 km.
  return Array.from({ length: points }, (_, i) => [8.5, 47 + (i * metresPerStep) / 111_195, rise[i] ?? 400] as Position);
}

describe("metrics", () => {
  it("ignores elevation noise below the threshold", () => {
    expect(ascentDescent([400, 401, 400, 402, 401, 400])).toEqual({ ascentM: 0, descentM: 0 });
    expect(ascentDescent([400, 410, 420, 405])).toEqual({ ascentM: 20, descentM: 15 });
  });

  it("detects a steep climb and warns about it", () => {
    const elevations = Array.from({ length: 21 }, (_, i) => 400 + (i <= 10 ? i * 10 : 100));
    const route = buildRoute({
      provider: "test",
      profile: "road",
      waypoints: [],
      coordinates: straightRoute(21, 100, elevations),
      rawSegments: [{ lengthM: 2000, tags: parseTags("highway=tertiary surface=asphalt") }],
      providerDurationS: null,
    });
    expect(route.maxGradePct).toBeCloseTo(10, 0);
    expect(route.ascentM).toBe(100);
    expect(route.warnings.map((w) => w.kind)).toContain("steep");
  });

  it("warns about unpaved stretches only on paved-riding profiles", () => {
    const base = {
      provider: "test",
      waypoints: [],
      coordinates: straightRoute(11, 100, []),
      rawSegments: [{ lengthM: 1000, tags: parseTags("highway=track surface=gravel") }],
      providerDurationS: null,
    };
    expect(buildRoute({ ...base, profile: "road" }).warnings.map((w) => w.kind)).toContain("unpaved");
    expect(buildRoute({ ...base, profile: "gravel" }).warnings).toHaveLength(0);
  });
});

describe("time model", () => {
  it("is slower uphill, on gravel and for less fit riders", () => {
    expect(speedKmh("intermediate", "road", "paved", 6)).toBeLessThan(speedKmh("intermediate", "road", "paved", 0));
    expect(speedKmh("intermediate", "road", "gravel", 0)).toBeLessThan(speedKmh("intermediate", "road", "paved", 0));
    expect(speedKmh("beginner", "road", "paved", 0)).toBeLessThan(speedKmh("strong", "road", "paved", 0));
  });

  it("caps descent speed", () => {
    expect(speedKmh("strong", "road", "paved", -20)).toBeLessThanOrEqual(45);
  });

  it("estimates 30 km of flat asphalt at the flat cruising speed", () => {
    const route = { profile: "road" as const, segments: [{ startM: 0, endM: 30_000, surface: "paved" as const, surfaceInferred: false, gradePct: 0, cycleway: false }] };
    expect(estimateDurationS(route, "intermediate")).toBe(Math.round((30 / 23) * 3600));
  });
});

describe("difficulty", () => {
  const base: Pick<Route, "distanceM" | "ascentM" | "maxGradePct" | "surfaceMix"> = {
    distanceM: 20_000,
    ascentM: 50,
    maxGradePct: 3,
    surfaceMix: { paved: 20_000, gravel: 0, trail: 0, unknown: 0 },
  };

  it("rates a short flat paved ride easy and a long mountain gravel ride hard", () => {
    expect(difficulty(base).level).toBe("easy");
    expect(
      difficulty({ distanceM: 140_000, ascentM: 3000, maxGradePct: 14, surfaceMix: { paved: 70_000, gravel: 70_000, trail: 0, unknown: 0 } }).level,
    ).toBe("extreme");
  });

  it("grows with climbing", () => {
    expect(difficulty({ ...base, ascentM: 600 }).score).toBeGreaterThan(difficulty(base).score);
  });
});

describe("surface percentages", () => {
  it("adds up to exactly 100", () => {
    const pct = surfacePercentages({ paved: 1, gravel: 1, trail: 1, unknown: 0 });
    expect(Object.values(pct).reduce((a, b) => a + b, 0)).toBe(100);
  });
});
