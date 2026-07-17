import { NextRequest, NextResponse } from "next/server";
import type { BikeType, PlannerResult } from "@/types";

interface BRouterFeature {
  properties: {
    "track-length": string;
    "filtered ascend": string;
    "total-time": string;
  };
  geometry: {
    type: "LineString";
    coordinates: [number, number, number?][];
  };
}

const profiles: Record<BikeType, "fastbike" | "trekking" | "safety"> = {
  road: "fastbike",
  gravel: "trekking",
  mountain: "trekking",
  city: "safety",
  electric: "fastbike",
  touring: "trekking",
};

function isPoint(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    start?: unknown;
    end?: unknown;
    profile?: BikeType;
    routeType?: "one-way" | "round-trip";
  };

  if (!isPoint(body.start) || !isPoint(body.end) || !body.profile || !profiles[body.profile]) {
    return NextResponse.json({ message: "The route request is incomplete." }, { status: 422 });
  }

  const points = [body.start, body.end];
  if (body.routeType === "round-trip") {
    points.push(body.start);
  }

  const url = new URL("https://brouter.de/brouter");
  url.searchParams.set(
    "lonlats",
    points.map(([lat, lng]) => `${lng},${lat}`).join("|"),
  );
  url.searchParams.set("profile", profiles[body.profile]);
  url.searchParams.set("alternativeidx", "0");
  url.searchParams.set("format", "geojson");

  const response = await fetch(url, {
    headers: {
      Accept: "application/geo+json, application/json",
      "User-Agent": "CycleLine/2.0 route planner",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ message: "No cycleable line could be calculated." }, { status: 502 });
  }

  const data = (await response.json()) as { features?: BRouterFeature[] };
  const feature = data.features?.[0];

  if (!feature?.geometry?.coordinates?.length) {
    return NextResponse.json({ message: "The routing service returned an empty line." }, { status: 502 });
  }

  const result: PlannerResult = {
    coordinates: feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: Math.round((Number(feature.properties["track-length"]) / 1000) * 10) / 10,
    durationMinutes: Math.max(1, Math.round(Number(feature.properties["total-time"]) / 60)),
    elevationGainM: Math.max(0, Math.round(Number(feature.properties["filtered ascend"]))),
  };

  return NextResponse.json(result);
}
