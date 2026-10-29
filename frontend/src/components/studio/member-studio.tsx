"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { saveStudioRouteAction } from "@/app/actions";
import type { Fitness, LatLng, RideProfile } from "@/lib/routing/types";
import { decodeShare, waypointId, type StudioDraft, type Waypoint } from "@/lib/studio";
import { RouteStudio } from "./route-studio";
import type { Studio } from "./use-studio";

// The chat is only downloaded when Route Studio renders it.
const AssistantPanel = dynamic(() => import("./assistant-panel").then((m) => m.AssistantPanel), { ssr: false });

const DRAFT_KEY = "cycleline-member-draft";

async function geocodeFirst(query: string): Promise<{ name: string; coordinates: LatLng } | null> {
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&limit=1`);
  if (!response.ok) return null;
  const data = (await response.json()) as { results?: { name: string; coordinates: LatLng }[] };
  return data.results?.[0] ?? null;
}

/** Route Studio for signed-in riders: saves to the account, starts from links or the last draft. */
export function MemberStudio({
  fitness,
  profile,
  bikeId,
  params,
}: {
  fitness: Fitness;
  profile: RideProfile;
  bikeId: number | null;
  params: { start?: string; end?: string; w?: string; p?: string; n?: string };
}) {
  const [init, setInit] = useState<{ waypoints: Waypoint[]; profile: RideProfile; name: string } | null>(null);
  const routeId = useRef<number | null>(null);

  // Starting point: a shared link, a start/end pair from a suggestion, or the last draft on this device.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const shared = decodeShare(params);
      if (shared) {
        setInit({ waypoints: shared.waypoints, profile: shared.profile ?? profile, name: shared.name ?? "" });
        return;
      }
      if (params.start && params.end) {
        const [a, b] = await Promise.all([geocodeFirst(params.start), geocodeFirst(params.end)]);
        if (cancelled) return;
        if (a && b) {
          setInit({
            waypoints: [
              { id: waypointId(), point: a.coordinates, label: a.name },
              { id: waypointId(), point: b.coordinates, label: b.name },
            ],
            profile,
            name: `${a.name} to ${b.name}`,
          });
          return;
        }
        toast.error("We couldn't find those places. Search for them on the left.");
      }
      try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as StudioDraft | null;
        if (draft?.waypoints?.length) {
          setInit({ waypoints: draft.waypoints, profile: draft.profile, name: draft.name });
          return;
        }
      } catch {
        // No usable draft.
      }
      setInit({ waypoints: [], profile, name: "" });
    })();
    return () => {
      cancelled = true;
    };
  }, [params, profile]);

  const saveDraft = useCallback((draft: StudioDraft) => {
    try {
      // The route itself is recalculated on load; only the plan is kept.
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, route: null }));
    } catch {
      // Storage full or blocked; the draft just isn't kept.
    }
  }, []);

  const save = useCallback(
    async (studio: Studio) => {
      const route = studio.route;
      if (!route) return false;
      const name = studio.name.trim() || "Untitled route";
      if (name.length < 3) {
        toast.error("Give the route a name of at least three characters.");
        return false;
      }
      const first = studio.waypoints[0];
      const last = studio.waypoints[studio.waypoints.length - 1];
      const label = (w: Waypoint) => w.label ?? `${w.point[0].toFixed(4)}, ${w.point[1].toFixed(4)}`;
      const result = await saveStudioRouteAction({
        routeId: routeId.current,
        name,
        startName: label(first),
        endName: label(last),
        bikeId,
        route,
        fitness: studio.fitness,
      });
      if (result.ok) {
        routeId.current = result.routeId ?? routeId.current;
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      return result.ok;
    },
    [bikeId],
  );

  if (!init) {
    return (
      <div className="map-loading" role="status">
        Opening Route Studio…
      </div>
    );
  }

  return (
    <RouteStudio
      mode="member"
      init={{ ...init, fitness }}
      saveRoute={save}
      onDraftChange={saveDraft}
      assistant={(studio, { inline }) => <AssistantPanel studio={studio} mode="member" inline={inline} />}
    />
  );
}
