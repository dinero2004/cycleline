"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { manualRoute, waypointId, type Waypoint } from "@/lib/studio";
import type { Fitness, LatLng, Position, RankedRoute, RideProfile, Route, RoutePreferences } from "@/lib/routing/types";

export interface ApiError {
  code: string;
  message: string;
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: ApiError };
  if (!response.ok) throw Object.assign(new Error(data.error?.message ?? "Something went wrong."), { code: data.error?.code ?? "internal" });
  return data;
}

const SNAP_DEBOUNCE_MS = 350;

function planKey(waypoints: Waypoint[], profile: RideProfile, preferences: RoutePreferences, snap: boolean) {
  return JSON.stringify([waypoints.map((w) => w.point), profile, preferences, snap]);
}
const MAX_HISTORY = 50;

export interface StudioInit {
  name?: string;
  waypoints?: Waypoint[];
  profile?: RideProfile;
  preferences?: RoutePreferences;
  snap?: boolean;
  route?: Route | null;
  fitness: Fitness;
}

/** Route Studio state: waypoints with undo, debounced snapping, optimistic line, alternatives and loops. */
export function useStudio(init: StudioInit) {
  const [name, setName] = useState(init.name ?? "");
  const [waypoints, setWaypointsState] = useState<Waypoint[]>(init.waypoints ?? []);
  const [history, setHistory] = useState<Waypoint[][]>([]);
  const [profile, setProfile] = useState<RideProfile>(init.profile ?? "road");
  const [preferences, setPreferences] = useState<RoutePreferences>(init.preferences ?? {});
  const [fitness, setFitness] = useState<Fitness>(init.fitness);
  const [snap, setSnap] = useState(init.snap ?? true);
  const [routeState, setRoute] = useState<Route | null>(init.route ?? null);
  const [alternatives, setAlternatives] = useState<RankedRoute[]>([]);
  const [busy, setBusy] = useState<null | "alternatives" | "loop">(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [activeD, setActiveD] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const abort = useRef<AbortController | null>(null);

  // What the current plan needs routed, and which plan the shown route (or error) belongs to.
  // Pending is derived from the two, so a ready route passed in (sample, saved, alternative) isn't re-routed.
  const requestKey = planKey(waypoints, profile, preferences, snap);
  const [resolvedKey, setResolvedKey] = useState<string | null>(() =>
    init.route ? planKey(init.waypoints ?? [], init.profile ?? "road", init.preferences ?? {}, init.snap ?? true) : null,
  );
  const resolvedRef = useRef(resolvedKey);
  const markResolved = useCallback((key: string) => {
    resolvedRef.current = key;
    setResolvedKey(key);
  }, []);
  const route = waypoints.length < 2 ? null : routeState;
  const pending = waypoints.length >= 2 && requestKey !== resolvedKey;

  const setWaypoints = useCallback((next: Waypoint[] | ((current: Waypoint[]) => Waypoint[]), record = true) => {
    setWaypointsState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      if (record && value !== current) setHistory((h) => [...h.slice(-MAX_HISTORY + 1), current]);
      return value;
    });
    setAlternatives([]);
    setDirty(true);
  }, []);

  const addWaypoint = useCallback(
    (point: LatLng, label?: string, index?: number) =>
      setWaypoints((current) => {
        const next = [...current];
        next.splice(index ?? next.length, 0, { id: waypointId(), point, label });
        return next.slice(0, 25);
      }),
    [setWaypoints],
  );
  const moveWaypoint = useCallback(
    (id: string, point: LatLng) => setWaypoints((current) => current.map((w) => (w.id === id ? { ...w, point, label: undefined } : w))),
    [setWaypoints],
  );
  const removeWaypoint = useCallback((id: string) => setWaypoints((current) => current.filter((w) => w.id !== id)), [setWaypoints]);
  const reorderWaypoint = useCallback(
    (id: string, delta: -1 | 1) =>
      setWaypoints((current) => {
        const i = current.findIndex((w) => w.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= current.length) return current;
        const next = [...current];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      }),
    [setWaypoints],
  );
  const reverse = useCallback(() => setWaypoints((current) => [...current].reverse()), [setWaypoints]);
  const clear = useCallback(() => setWaypoints([]), [setWaypoints]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      setWaypointsState(h[h.length - 1]);
      setAlternatives([]);
      return h.slice(0, -1);
    });
  }, []);

  // Route whenever the plan changes, after a short pause so dragging and quick clicks don't flood the API.
  useEffect(() => {
    if (waypoints.length < 2 || requestKey === resolvedRef.current) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const key = requestKey;
    const points = waypoints.map((w) => w.point);
    const timer = setTimeout(async () => {
      try {
        if (snap) {
          const data = await postJson<{ route: Route }>("/api/route", { waypoints: points, profile, preferences, fitness }, controller.signal);
          setRoute(data.route);
        } else {
          const data = await postJson<{ coordinates: Position[] }>("/api/elevation", { coordinates: points }, controller.signal);
          setRoute(manualRoute(data.coordinates, points, profile));
        }
        setError(null);
        markResolved(key);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError({ code: (e as { code?: string }).code ?? "internal", message: (e as Error).message });
        markResolved(key);
      }
    }, SNAP_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // requestKey covers waypoints, profile, preferences and snap; fitness only changes the
    // time estimate, which is computed client-side.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const compare = useCallback(async () => {
    if (waypoints.length < 2) return;
    setBusy("alternatives");
    setError(null);
    try {
      const data = await postJson<{ routes: RankedRoute[] }>("/api/route/alternatives", {
        waypoints: waypoints.map((w) => w.point),
        profile,
        preferences,
        fitness,
      });
      setAlternatives(data.routes);
    } catch (e) {
      setError({ code: (e as { code?: string }).code ?? "internal", message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }, [waypoints, profile, preferences, fitness]);

  const planLoop = useCallback(
    async (distanceKm: number, bearing?: number) => {
      const start = waypoints[0]?.point;
      if (!start) return;
      setBusy("loop");
      setError(null);
      try {
        const data = await postJson<{ routes: RankedRoute[] }>("/api/route/loop", { start, distanceKm, bearing, profile, preferences, fitness });
        setAlternatives(data.routes);
      } catch (e) {
        setError({ code: (e as { code?: string }).code ?? "internal", message: (e as Error).message });
      } finally {
        setBusy(null);
      }
    },
    [waypoints, profile, preferences, fitness],
  );

  /** Shows a route that was already calculated (alternative, AI suggestion, saved route) without re-routing. */
  const showRoute = useCallback((next: Route) => {
    setWaypointsState((current) => {
      setHistory((h) => [...h.slice(-MAX_HISTORY + 1), current]);
      // Keep place names for waypoints that didn't move.
      const nextWaypoints = next.waypoints.map((point) => ({
        id: waypointId(),
        point,
        label: current.find((w) => Math.abs(w.point[0] - point[0]) < 1e-6 && Math.abs(w.point[1] - point[1]) < 1e-6)?.label,
      }));
      markResolved(planKey(nextWaypoints, next.profile, preferences, snap));
      return nextWaypoints;
    });
    setRoute(next);
    setProfile(next.profile);
    setError(null);
    setDirty(true);
  }, [markResolved, preferences, snap]);

  return {
    name, setName: (value: string) => { setName(value); setDirty(true); },
    waypoints, addWaypoint, moveWaypoint, removeWaypoint, reorderWaypoint, reverse, clear,
    undo, canUndo: history.length > 0,
    profile, setProfile: (value: RideProfile) => { setProfile(value); setDirty(true); },
    preferences, setPreferences: (value: RoutePreferences) => { setPreferences(value); setDirty(true); },
    fitness, setFitness, snap, setSnap,
    route, pending, error, clearError: () => setError(null),
    alternatives, setAlternatives, compare, planLoop, busy, showRoute,
    activeD, setActiveD, dirty, saved, markSaved: () => { setDirty(false); setSaved(true); },
  };
}

export type Studio = ReturnType<typeof useStudio>;
