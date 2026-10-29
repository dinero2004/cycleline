import type { LatLng, Position } from "./types";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const coord = (n: number) => n.toFixed(6);

export interface GpxInput {
  name: string;
  description?: string;
  coordinates: (Position | LatLng)[];
  waypoints?: { point: LatLng; name: string }[];
  /** Adds a note to the track description, used for limited guest exports. */
  watermark?: string;
  time?: Date;
}

/** GPX 1.1 with a track (elevation when known) and named waypoints. */
export function buildGpx({ name, description, coordinates, waypoints = [], watermark, time = new Date() }: GpxInput): string {
  const desc = [description, watermark].filter(Boolean).join(" — ");
  const trkpts = coordinates
    .map((c) => {
      // Position is [lng, lat, ele]; LatLng is [lat, lng].
      const [lat, lng, ele] = c.length === 3 ? [c[1], c[0], c[2]] : [c[0], c[1], undefined];
      return `<trkpt lat="${coord(lat)}" lon="${coord(lng)}">${ele === undefined ? "" : `<ele>${ele.toFixed(1)}</ele>`}</trkpt>`;
    })
    .join("\n      ");
  const wpts = waypoints
    .map(({ point: [lat, lng], name: label }) => `<wpt lat="${coord(lat)}" lon="${coord(lng)}"><name>${escapeXml(label)}</name></wpt>`)
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CycleLine" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>${desc ? `\n    <desc>${escapeXml(desc)}</desc>` : ""}
    <time>${time.toISOString()}</time>
  </metadata>${wpts ? `\n  ${wpts}` : ""}
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
      ${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function gpxFileName(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cycleline-route"}.gpx`;
}
