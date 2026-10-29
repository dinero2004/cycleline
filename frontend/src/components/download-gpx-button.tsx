"use client";

import { Download } from "lucide-react";
import { buildGpx, gpxFileName } from "@/lib/routing/gpx";
import type { SavedRoute } from "@/types";

export function DownloadGpxButton({ route }: { route: Pick<SavedRoute, "name" | "coordinates" | "details"> }) {
  function download() {
    const waypoints = route.details?.waypoints ?? [];
    const gpx = buildGpx({
      name: route.name,
      coordinates: route.coordinates,
      waypoints: waypoints.map((point, i) => ({
        point,
        name: i === 0 ? "Start" : i === waypoints.length - 1 ? "Finish" : `Waypoint ${i + 1}`,
      })),
    });
    const url = URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = gpxFileName(route.name);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="icon-button" onClick={download} aria-label={`Download ${route.name} as GPX`}>
      <Download size={17} />
    </button>
  );
}
