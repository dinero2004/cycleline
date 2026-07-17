"use client";

import { Download } from "lucide-react";
import type { SavedRoute } from "@/types";

export function DownloadGpxButton({ route }: { route: Pick<SavedRoute, "name" | "coordinates"> }) {
  function download() {
    const points = route.coordinates
      .map(([lat, lng]) => `<trkpt lat="${lat}" lon="${lng}"></trkpt>`)
      .join("");
    const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="CycleLine"><trk><name>${route.name}</name><trkseg>${points}</trkseg></trk></gpx>`;
    const url = URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${route.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.gpx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="icon-button" onClick={download} aria-label={`Download ${route.name} as GPX`}>
      <Download size={17} />
    </button>
  );
}
