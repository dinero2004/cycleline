"use client";

import { ArrowUpDown, LoaderCircle, LocateFixed } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { LatLng } from "@/lib/routing/types";
import { PlaceSearch } from "./place-search";
import type { Studio } from "./use-studio";

const MY_LOCATION = "My location";

const placeLabel = (label: string | undefined, point: LatLng) => label ?? `Pin at ${point[0].toFixed(4)}, ${point[1].toFixed(4)}`;

function locationError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return "Location is blocked for this site. Allow it in your browser settings, or search for your start.";
  if (error.code === error.TIMEOUT) return "Finding your location took too long. Try again or search for your start.";
  return "Your location isn't available right now. Search for your start instead.";
}

/**
 * Start and destination side by side, like any route planner. The start can be the rider's location.
 * A destination picked before a start waits here until the start is known.
 */
export function RouteEnds({ studio, onStartPicked }: { studio: Studio; onStartPicked?: () => void }) {
  const { waypoints } = studio;
  const [waitingFinish, setWaitingFinish] = useState<{ point: LatLng; label: string } | null>(null);
  const [locating, setLocating] = useState(false);

  const start = waypoints[0];
  const finish = waypoints.length > 1 ? waypoints[waypoints.length - 1] : null;
  const finishValue = finish ? placeLabel(finish.label, finish.point) : waitingFinish && !start ? waitingFinish.label : "";

  function pickStart(point: LatLng, label: string) {
    const first = waypoints.length === 0;
    studio.setStart(point, label);
    if (first && waitingFinish) {
      studio.setFinish(waitingFinish.point, waitingFinish.label);
      setWaitingFinish(null);
    }
    if (first) onStartPicked?.();
  }

  function pickFinish(point: LatLng, label: string) {
    if (!waypoints.length) {
      setWaitingFinish({ point, label });
      toast.info("Now set your start, or use your location.");
      return;
    }
    studio.setFinish(point, label);
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("This browser can't share your location. Search for your start instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        pickStart([position.coords.latitude, position.coords.longitude], MY_LOCATION);
      },
      (error) => {
        setLocating(false);
        toast.error(locationError(error));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="route-ends" role="group" aria-label="Start and destination">
      <PlaceSearch
        label="Start"
        placeholder="Start: search a place"
        value={start ? placeLabel(start.label, start.point) : ""}
        icon={<span className="end-dot start" />}
        onPick={(place) => pickStart(place.coordinates, place.name)}
        action={
          <button
            type="button"
            className="field-action"
            onClick={useMyLocation}
            disabled={locating}
            aria-label="Use my location as the start"
            title="Use my location"
          >
            {locating ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : <LocateFixed size={18} aria-hidden="true" />}
          </button>
        }
      />
      <PlaceSearch
        label="Destination"
        placeholder="Destination: where to?"
        value={finishValue}
        icon={<span className="end-dot finish" />}
        onPick={(place) => pickFinish(place.coordinates, place.name)}
      />
      <button
        type="button"
        className="route-ends-swap icon-button"
        onClick={studio.reverse}
        disabled={waypoints.length < 2}
        aria-label="Swap start and destination"
        title="Swap start and destination"
      >
        <ArrowUpDown size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
