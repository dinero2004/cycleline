"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  Bike as BikeIcon,
  Check,
  Download,
  LoaderCircle,
  MapPin,
  Mountain,
  Route,
  Save,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { saveRouteAction } from "@/app/actions";
import type { Bike, BikeType, FitnessLevel, PlannerResult } from "@/types";

const PlannerMap = dynamic(() => import("@/components/planner-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading the map…</div>,
});

interface PlaceResult {
  name: string;
  coordinates: [number, number];
}

export function RoutePlanner({
  bikes,
  fitnessLevel,
  initialStart = "",
  initialEnd = "",
}: {
  bikes: Bike[];
  fitnessLevel: FitnessLevel;
  initialStart?: string;
  initialEnd?: string;
}) {
  const defaultBike = bikes.find((bike) => bike.is_default) ?? bikes[0];
  const [startName, setStartName] = useState(initialStart);
  const [endName, setEndName] = useState(initialEnd);
  const [profile, setProfile] = useState<BikeType>(defaultBike?.type ?? "road");
  const [bikeId, setBikeId] = useState<number | null>(defaultBike?.id ?? null);
  const [routeType, setRouteType] = useState<"one-way" | "round-trip">("one-way");
  const [difficulty, setDifficulty] = useState<FitnessLevel>(fitnessLevel);
  const [result, setResult] = useState<PlannerResult | null>(null);
  const [places, setPlaces] = useState<{ start: PlaceResult; end: PlaceResult } | null>(null);
  const [routeName, setRouteName] = useState("");
  const [description, setDescription] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedBike = bikes.find((bike) => bike.id === bikeId);

  async function geocode(query: string): Promise<PlaceResult> {
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const data = (await response.json()) as PlaceResult & { message?: string };
    if (!response.ok) {
      throw new Error(data.message ?? "Location not found.");
    }
    return data;
  }

  async function calculateRoute() {
    if (startName.trim().length < 3 || endName.trim().length < 3) {
      toast.error("Add a clear start and destination.");
      return;
    }

    setIsCalculating(true);
    setResult(null);

    try {
      const [start, end] = await Promise.all([geocode(startName), geocode(endName)]);
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: start.coordinates,
          end: end.coordinates,
          profile,
          routeType,
        }),
      });
      const route = (await response.json()) as PlannerResult & { message?: string };
      if (!response.ok) {
        throw new Error(route.message ?? "No route could be calculated.");
      }
      setPlaces({ start, end });
      setResult(route);
      setRouteName(`${startName.split(",")[0]} to ${endName.split(",")[0]}`);
      toast.success("Your line is ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Route calculation failed.");
    } finally {
      setIsCalculating(false);
    }
  }

  async function saveRoute() {
    if (!result || !places || !routeName.trim()) {
      toast.error("Calculate and name the route first.");
      return;
    }

    setIsSaving(true);
    const response = await saveRouteAction({
      ...result,
      name: routeName,
      description,
      startName,
      endName,
      start: places.start.coordinates,
      end: places.end.coordinates,
      difficulty,
      routeType,
      profile,
      bikeId,
    });
    setIsSaving(false);
    if (response.ok) {
      toast.success(response.message);
    } else {
      toast.error(response.message);
    }
  }

  function downloadGpx() {
    if (!result) return;
    const points = result.coordinates
      .map(([lat, lng]) => `<trkpt lat="${lat}" lon="${lng}"></trkpt>`)
      .join("");
    const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="CycleLine"><trk><name>${routeName || "CycleLine route"}</name><trkseg>${points}</trkseg></trk></gpx>`;
    const url = URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(routeName || "cycleline-route").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.gpx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="planner-workspace">
      <section className="planner-controls">
        <div className="panel-heading">
          <span className="eyebrow">Route brief</span>
          <h2>Where are we riding?</h2>
        </div>

        <div className="location-stack">
          <label>
            Start
            <span className="input-wrap">
              <span className="location-dot start" />
              <input value={startName} onChange={(event) => setStartName(event.target.value)} placeholder="Zürich HB" />
            </span>
          </label>
          <label>
            Destination
            <span className="input-wrap">
              <MapPin size={17} />
              <input value={endName} onChange={(event) => setEndName(event.target.value)} placeholder="Baden railway station" />
            </span>
          </label>
        </div>

        <fieldset>
          <legend>Ride profile</legend>
          <div className="choice-grid">
            {(["road", "gravel", "mountain", "city", "electric", "touring"] as BikeType[]).map((type) => (
              <button key={type} type="button" className={profile === type ? "choice active" : "choice"} onClick={() => setProfile(type)}>
                {profile === type && <Check size={14} />}
                {type}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="two-column-fields">
          <label>
            Format
            <select value={routeType} onChange={(event) => setRouteType(event.target.value as "one-way" | "round-trip")}>
              <option value="one-way">One way</option>
              <option value="round-trip">Return to start</option>
            </select>
          </label>
          <label>
            Bike
            <select value={bikeId ?? ""} onChange={(event) => setBikeId(event.target.value ? Number(event.target.value) : null)}>
              <option value="">No bike selected</option>
              {bikes.map((bike) => (
                <option key={bike.id} value={bike.id}>
                  {bike.name} · {bike.type}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="button" className="button button-dark button-full" onClick={calculateRoute} disabled={isCalculating}>
          {isCalculating ? <LoaderCircle className="spin" size={18} /> : <Route size={18} />}
          {isCalculating ? "Finding the best line…" : "Calculate route"}
        </button>

        {result && (
          <div className="save-panel">
            <div className="route-metrics">
              <span>
                <strong>{result.distanceKm}</strong> km
              </span>
              <span>
                <Timer size={15} />
                <strong>{Math.floor(result.durationMinutes / 60)}h {result.durationMinutes % 60}m</strong>
              </span>
              <span>
                <Mountain size={15} />
                <strong>{result.elevationGainM} m</strong>
              </span>
            </div>
            <label>
              Route name
              <input value={routeName} onChange={(event) => setRouteName(event.target.value)} />
            </label>
            <label>
              Notes
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Surface, coffee stop, or training intention…" />
            </label>
            <label>
              Difficulty
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as FitnessLevel)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <div className="save-actions">
              <button type="button" className="button button-acid" onClick={saveRoute} disabled={isSaving}>
                {isSaving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
                Save route
              </button>
              <button type="button" className="button button-ghost" onClick={downloadGpx}>
                <Download size={17} /> GPX
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="planner-map-panel">
        <div className="map-toolbar">
          <div>
            <span className="eyebrow">Live route</span>
            <strong>{result ? routeName || "Untitled route" : "Add two places to begin"}</strong>
          </div>
          {selectedBike && (
            <span className="bike-pill">
              <BikeIcon size={15} />
              {selectedBike.name}
            </span>
          )}
        </div>
        <PlannerMap coordinates={result?.coordinates ?? []} />
        {!result && (
          <div className="map-empty-overlay">
            <span>
              <MapPin size={22} />
            </span>
            <strong>Your line will appear here.</strong>
            <p>CycleLine uses OpenStreetMap, Nominatim, and BRouter data.</p>
          </div>
        )}
      </section>
    </div>
  );
}
