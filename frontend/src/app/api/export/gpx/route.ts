import { errorResponse, parseBody } from "@/lib/api";
import { GUEST_GPX_NOTE } from "@/lib/guest";
import { requestContext } from "@/lib/request-context";
import { buildGpx, gpxFileName } from "@/lib/routing/gpx";
import { gpxRequest } from "@/lib/routing/schema";

/** POST /api/export/gpx — GPX 1.1 with track, waypoints and elevation. Guest exports carry a note. */
export async function POST(request: Request) {
  try {
    const input = await parseBody(request, gpxRequest);
    const ctx = await requestContext();
    const gpx = buildGpx({ ...input, watermark: ctx.isGuest ? GUEST_GPX_NOTE : undefined });
    return new Response(gpx, {
      headers: {
        "Content-Type": "application/gpx+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${gpxFileName(input.name)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
