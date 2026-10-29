"use client";

import dynamic from "next/dynamic";
import type L from "leaflet";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  LoaderCircle,
  Magnet,
  MapPin,
  Minus,
  PenLine,
  Plus,
  Repeat,
  Save,
  Share2,
  Shuffle,
  Trash2,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ElevationChart } from "@/components/viz/elevation-chart";
import { SurfaceBar, surfaceSummary } from "@/components/viz/surface-bar";
import { useMediaQuery } from "@/components/use-media-query";
import { difficulty, estimateDurationS, formatDuration, formatM } from "@/lib/routing/metrics";
import type { Fitness, RankedRoute, Route } from "@/lib/routing/types";
import { encodeShare, RIDE_PROFILES, type StudioDraft } from "@/lib/studio";
import { BottomSheet, type SheetSnap } from "./bottom-sheet";
import { PlaceSearch } from "./place-search";
import type { MapLayer } from "./studio-map";
import { useStudio, type Studio, type StudioInit } from "./use-studio";

const StudioMap = dynamic(() => import("./studio-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      Loading the map…
    </div>
  ),
});

export type GateReason = "save" | "export" | "share" | "quota";

const FITNESS_LABEL: Record<Fitness, string> = { beginner: "Beginner", intermediate: "Intermediate", strong: "Strong" };

/** Screen-reader summary of the current route. */
export function routeSummary(route: Route, fitness: Fitness) {
  const d = difficulty(route);
  return `${formatM(route.distanceM)}, ${route.ascentM} m up and ${route.descentM} m down, about ${formatDuration(
    estimateDurationS(route, fitness),
  )} for a ${fitness} rider, ${d.level} difficulty, steepest ${route.maxGradePct}%. ${surfaceSummary(route.surfaceMix, route.inferredSurfaceM)}`;
}

function Metrics({ route, fitness }: { route: Route | null; fitness: Fitness }) {
  const d = route ? difficulty(route) : null;
  return (
    <dl className="studio-metrics">
      <div>
        <dt>Distance</dt>
        <dd>{route ? (route.distanceM / 1000).toFixed(1) : "–"} <small>km</small></dd>
      </div>
      <div>
        <dt>Elevation</dt>
        <dd>{route ? `+${route.ascentM}` : "–"} <small>m</small></dd>
      </div>
      <div>
        <dt>Time</dt>
        <dd>{route ? formatDuration(estimateDurationS(route, fitness)) : "–"}</dd>
      </div>
      <div>
        <dt>Difficulty</dt>
        <dd className={d ? `difficulty-${d.level}` : undefined}>{d ? d.level : "–"}</dd>
      </div>
    </dl>
  );
}

function ElevationPanel({ studio, compact = false }: { studio: Studio; compact?: boolean }) {
  const { route } = studio;
  if (!route || route.elevation.length < 2) return null;
  return (
    <section className={`elevation-panel${compact ? " compact" : ""}`} aria-label="Elevation profile">
      <div className="elevation-panel-head">
        <span className="eyebrow">Elevation</span>
        <dl>
          <div>
            <dt>Max grade</dt>
            <dd>{route.maxGradePct}%</dd>
          </div>
          <div>
            <dt>Avg climb</dt>
            <dd>{route.avgGradePct}%</dd>
          </div>
          <div>
            <dt>Down</dt>
            <dd>−{route.descentM} m</dd>
          </div>
        </dl>
        <ul className="grade-legend" aria-label="Gradient colours">
          <li className="grade-easy">&lt; 4%</li>
          <li className="grade-moderate">4–8%</li>
          <li className="grade-steep">&gt; 8%</li>
        </ul>
      </div>
      <ElevationChart
        points={route.elevation}
        segments={route.segments}
        activeD={studio.activeD}
        onActiveChange={studio.setActiveD}
        height={compact ? 96 : 120}
      />
    </section>
  );
}

function WaypointList({ studio }: { studio: Studio }) {
  const { waypoints } = studio;
  if (!waypoints.length) {
    return <p className="studio-hint">Search for a place, click the map, or press and hold on a phone to add your start.</p>;
  }
  return (
    <ol className="waypoint-list">
      {waypoints.map((w, i) => {
        const role = i === 0 ? "Start" : i === waypoints.length - 1 ? "Finish" : `Waypoint ${i + 1}`;
        return (
          <li key={w.id}>
            <span className={`wp-badge ${i === 0 ? "start" : i === waypoints.length - 1 ? "finish" : ""}`} aria-hidden="true">
              {i === 0 || i === waypoints.length - 1 ? "" : i + 1}
            </span>
            <span className="wp-text">
              <strong>{role}</strong>
              <span>{w.label ?? `${w.point[0].toFixed(4)}, ${w.point[1].toFixed(4)}`}</span>
            </span>
            <span className="wp-actions">
              <button type="button" className="icon-button small" onClick={() => studio.reorderWaypoint(w.id, -1)} disabled={i === 0} aria-label={`Move ${role} up`}>
                <ArrowUp size={15} />
              </button>
              <button type="button" className="icon-button small" onClick={() => studio.reorderWaypoint(w.id, 1)} disabled={i === waypoints.length - 1} aria-label={`Move ${role} down`}>
                <ArrowDown size={15} />
              </button>
              <button type="button" className="icon-button small danger" onClick={() => studio.removeWaypoint(w.id)} aria-label={`Remove ${role}`}>
                <Trash2 size={15} />
              </button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Warnings({ route }: { route: Route }) {
  if (!route.warnings.length && route.surfaceMix.unknown === 0) return null;
  const steep = route.warnings.some((w) => w.kind === "steep");
  const unpaved = route.warnings.some((w) => w.kind === "unpaved");
  return (
    <section className="studio-section" aria-labelledby="warnings-title">
      <h3 id="warnings-title" className="eyebrow">Heads-up</h3>
      <ul className="warning-list">
        {route.warnings.slice(0, 6).map((w, i) => (
          <li key={i}>
            <AlertTriangle size={15} aria-hidden="true" />
            {w.message} <span className="muted">at {formatM(w.startM)}</span>
          </li>
        ))}
        {route.warnings.length > 6 && <li className="muted">and {route.warnings.length - 6} more</li>}
        {route.surfaceMix.unknown > 0 && (
          <li>
            <AlertTriangle size={15} aria-hidden="true" />
            {formatM(route.surfaceMix.unknown)} has no surface data in OpenStreetMap.
          </li>
        )}
      </ul>
      {(steep || unpaved) && (
        <p className="safety-note">
          {steep ? "Steep sections: check your brakes and gearing, and walk if it feels unsafe. " : ""}
          {unpaved ? "Unpaved sections can be loose or muddy after rain; wider tyres help." : ""}
        </p>
      )}
    </section>
  );
}

function Candidates({ studio }: { studio: Studio }) {
  if (!studio.alternatives.length) return null;
  return (
    <section className="studio-section" aria-labelledby="candidates-title">
      <h3 id="candidates-title" className="eyebrow">Options</h3>
      <ul className="candidate-list">
        {studio.alternatives.map((r: RankedRoute, i) => {
          const selected = studio.route?.id === r.id;
          return (
            <li key={r.id}>
              <button type="button" className={`candidate${selected ? " selected" : ""}`} aria-pressed={selected} onClick={() => studio.showRoute(r)}>
                <span className="candidate-head">
                  <strong>Option {i + 1}</strong>
                  <span>{(r.distanceM / 1000).toFixed(1)} km · +{r.ascentM} m · {formatDuration(estimateDurationS(r, studio.fitness))}</span>
                </span>
                <SurfaceBar mix={r.surfaceMix} inferredM={r.inferredSurfaceM} legend={false} compact />
                <span className="candidate-why">{r.why}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LoopPlanner({ studio }: { studio: Studio }) {
  const [km, setKm] = useState(40);
  const [bearing, setBearing] = useState<string>("any");
  const disabled = !studio.waypoints.length || studio.busy !== null;
  return (
    <form
      className="loop-form"
      onSubmit={(event) => {
        event.preventDefault();
        void studio.planLoop(km, bearing === "any" ? undefined : Number(bearing));
      }}
    >
      <label>
        Loop distance
        <span className="input-suffix">
          <input type="number" inputMode="numeric" min={5} max={200} value={km} onChange={(e) => setKm(Number(e.target.value))} />
          km
        </span>
      </label>
      <label>
        Head
        <select value={bearing} onChange={(e) => setBearing(e.target.value)}>
          <option value="any">Any direction</option>
          <option value="0">North</option>
          <option value="90">East</option>
          <option value="180">South</option>
          <option value="270">West</option>
        </select>
      </label>
      <button type="submit" className="button button-secondary button-small" disabled={disabled}>
        {studio.busy === "loop" ? <LoaderCircle size={15} className="spin" /> : <Repeat size={15} />} Loop from start
      </button>
    </form>
  );
}

function Preferences({ studio, showFitness }: { studio: Studio; showFitness: boolean }) {
  const p = studio.preferences;
  const set = (patch: Partial<typeof p>) => studio.setPreferences({ ...p, ...patch });
  return (
    <section className="studio-section" aria-labelledby="prefs-title">
      <h3 id="prefs-title" className="eyebrow">Ride</h3>
      <div className="segmented" role="radiogroup" aria-label="Ride profile">
        {RIDE_PROFILES.map(({ value, label }) => (
          <button key={value} type="button" role="radio" aria-checked={studio.profile === value} className={studio.profile === value ? "active" : ""} onClick={() => studio.setProfile(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className="pref-grid">
        <label>
          Max grade
          <select value={p.maxGradePct ?? ""} onChange={(e) => set({ maxGradePct: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">No limit</option>
            {[6, 8, 10, 12].map((g) => (
              <option key={g} value={g}>{g}%</option>
            ))}
          </select>
        </label>
        <label>
          Surface
          <select value={p.surface ?? ""} onChange={(e) => set({ surface: (e.target.value || undefined) as typeof p.surface })}>
            <option value="">Any</option>
            <option value="paved">Paved</option>
            <option value="mixed">Mixed</option>
            <option value="gravel">Gravel</option>
          </select>
        </label>
        {showFitness && (
          <label>
            Fitness
            <select value={studio.fitness} onChange={(e) => studio.setFitness(e.target.value as Fitness)}>
              {(Object.keys(FITNESS_LABEL) as Fitness[]).map((f) => (
                <option key={f} value={f}>{FITNESS_LABEL[f]}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="toggle-row">
        <label className="toggle">
          <input type="checkbox" checked={Boolean(p.minimizeTraffic)} onChange={(e) => set({ minimizeTraffic: e.target.checked })} />
          Quiet roads
        </label>
        <label className="toggle">
          <input type="checkbox" checked={Boolean(p.preferCycleways)} onChange={(e) => set({ preferCycleways: e.target.checked })} />
          Prefer cycleways
        </label>
      </div>
      <p className="studio-hint">Max grade and surface rank the options; they can&apos;t forbid a road the only way through uses.</p>
    </section>
  );
}

export function RouteStudio({
  init,
  mode,
  saveRoute,
  onGate,
  onDraftChange,
  assistant,
  banner,
}: {
  init: StudioInit;
  mode: "member" | "guest";
  /** Members: persists the route; returns false when it failed (the toast is shown by the caller). */
  saveRoute?: (studio: Studio) => Promise<boolean>;
  /** Guests: called at natural conversion moments instead of the member action. */
  onGate?: (reason: GateReason) => void;
  onDraftChange?: (draft: StudioDraft) => void;
  assistant?: (studio: Studio) => ReactNode;
  banner?: ReactNode;
}) {
  const studio = useStudio(init);
  const isPhone = useMediaQuery("(max-width: 760px)");
  const [collapsed, setCollapsed] = useState(false);
  const [draw, setDraw] = useState(true);
  const [layer, setLayer] = useState<MapLayer>("map");
  const [sheet, setSheet] = useState<SheetSnap>("peek");
  const [saving, setSaving] = useState(false);
  const [fitKey, setFitKey] = useState("init");
  const map = useRef<L.Map | null>(null);
  const searchBox = useRef<HTMLDivElement>(null);
  const { route } = studio;

  // Refit when a whole route arrives from elsewhere (alternatives, loops, the assistant).
  const routeId = route?.id;
  const lastShown = useRef<string | undefined>(routeId);
  useEffect(() => {
    if (routeId && studio.alternatives.some((a) => a.id === routeId) && lastShown.current !== routeId) setFitKey(routeId);
    lastShown.current = routeId;
  }, [routeId, studio.alternatives]);

  // Errors from the routing API.
  useEffect(() => {
    if (!studio.error) return;
    if (studio.error.code === "rate_limited" && mode === "guest") onGate?.("quota");
    else toast.error(studio.error.message);
  }, [studio.error, mode, onGate]);

  // Draft persistence (guest drafts; also lets members recover after a reload or going offline).
  const { name, waypoints, profile, preferences, snap } = studio;
  useEffect(() => {
    if (!onDraftChange) return;
    const timer = setTimeout(() => onDraftChange({ name, waypoints, profile, preferences, snap, route, updatedAt: Date.now() }), 500);
    return () => clearTimeout(timer);
  }, [name, waypoints, profile, preferences, snap, route, onDraftChange]);

  // Ctrl/Cmd+Z undoes the last waypoint change.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        studio.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio]);

  const onReady = useCallback((m: L.Map) => {
    map.current = m;
  }, []);

  const routeName = studio.name || "Untitled route";
  const status = studio.pending
    ? "Routing…"
    : !route
      ? "Draft"
      : mode === "guest"
        ? "Draft on this device"
        : studio.saved && !studio.dirty
          ? "Saved"
          : "Not saved";

  async function save() {
    if (!route) {
      toast.error("Add at least a start and a finish first.");
      return;
    }
    if (mode === "guest") return onGate?.("save");
    if (!saveRoute) return;
    setSaving(true);
    const ok = await saveRoute(studio);
    setSaving(false);
    if (ok) studio.markSaved();
  }

  async function exportGpx() {
    if (!route) {
      toast.error("There is no route to export yet.");
      return;
    }
    if (mode === "guest") onGate?.("export");
    const response = await fetch("/api/export/gpx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: routeName,
        coordinates: route.geometry.coordinates,
        waypoints: studio.waypoints.map((w, i) => ({
          point: w.point,
          name: w.label ?? (i === 0 ? "Start" : i === studio.waypoints.length - 1 ? "Finish" : `Waypoint ${i + 1}`),
        })),
      }),
    });
    if (!response.ok) {
      toast.error("The GPX export failed. Try again.");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "cycleline-route.gpx";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function share() {
    if (studio.waypoints.length < 2) {
      toast.error("Add a start and a finish to share the route.");
      return;
    }
    if (mode === "guest") onGate?.("share");
    const url = `${window.location.origin}${window.location.pathname}?${encodeShare(studio.waypoints, studio.profile, studio.name)}`;
    try {
      if (navigator.share && isPhone) await navigator.share({ title: routeName, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied. Anyone with it sees the same waypoints.");
      }
    } catch {
      // Share sheet dismissed.
    }
  }

  const summary = useMemo(() => (route ? routeSummary(route, studio.fitness) : "No route yet."), [route, studio.fitness]);

  const panel = (
    <>
      <section className="studio-section" aria-labelledby="overview-title">
        <h3 id="overview-title" className="eyebrow">Route overview</h3>
        <div ref={searchBox}>
          <PlaceSearch
            label={studio.waypoints.length ? "Add a waypoint" : "Start"}
            placeholder={studio.waypoints.length ? "Add a place…" : "Where do you start?"}
            onPick={(place) => {
              studio.addWaypoint(place.coordinates, place.name);
              if (studio.waypoints.length === 0) setFitKey(`start-${Date.now()}`);
            }}
          />
        </div>
        <Metrics route={route} fitness={studio.fitness} />
        {route && <SurfaceBar mix={route.surfaceMix} inferredM={route.inferredSurfaceM} />}
        {route && route.inferredSurfaceM > 0 && (
          <p className="studio-hint">{formatM(route.inferredSurfaceM)} counted as paved from the road type (not tagged).</p>
        )}
      </section>

      <section className="studio-section" aria-labelledby="waypoints-title">
        <div className="section-row">
          <h3 id="waypoints-title" className="eyebrow">Waypoints</h3>
          {studio.waypoints.length > 1 && (
            <button type="button" className="link-button" onClick={studio.reverse}>
              <Shuffle size={14} /> Reverse
            </button>
          )}
        </div>
        <WaypointList studio={studio} />
        <div className="button-row">
          <button type="button" className="button button-secondary button-small" onClick={() => void studio.compare()} disabled={studio.waypoints.length < 2 || studio.busy !== null}>
            {studio.busy === "alternatives" ? <LoaderCircle size={15} className="spin" /> : <Shuffle size={15} />} Compare routes
          </button>
          {studio.waypoints.length > 0 && (
            <button type="button" className="link-button danger" onClick={studio.clear}>
              Clear
            </button>
          )}
        </div>
        <LoopPlanner studio={studio} />
      </section>

      <Candidates studio={studio} />
      {route && <Warnings route={route} />}
      <Preferences studio={studio} showFitness={mode === "guest"} />
      {isPhone && <ElevationPanel studio={studio} compact />}
      {isPhone && assistant?.(studio)}
    </>
  );

  return (
    <div className={`route-studio${collapsed ? " side-collapsed" : ""}`} data-tour="studio">
      <header className="studio-topbar">
        <label className="studio-name">
          <span className="visually-hidden">Route name</span>
          <input value={studio.name} onChange={(e) => studio.setName(e.target.value)} placeholder="Untitled route" maxLength={120} />
        </label>
        <span className={`studio-status${studio.saved && !studio.dirty ? "" : " dirty"}`} role="status" aria-live="polite">
          {studio.pending ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : studio.saved && !studio.dirty && route ? <Check size={14} aria-hidden="true" /> : null}
          {status}
        </span>
        <div className="studio-topbar-actions">
          <button type="button" className="button button-secondary button-small" onClick={() => void share()} data-tour="share">
            <Share2 size={15} /> <span className="hide-sm">Share</span>
          </button>
          <button type="button" className="button button-secondary button-small" onClick={() => void save()} disabled={saving} data-tour="save">
            {saving ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />} <span className="hide-sm">Save</span>
          </button>
          <button type="button" className="button button-primary button-small" onClick={() => void exportGpx()} data-tour="export">
            <Download size={15} /> <span className="hide-sm">Export</span> GPX
          </button>
        </div>
      </header>
      {banner}

      <div className="studio-body">
        {!isPhone && (
          <aside className="studio-side" aria-label="Route details" id="studio-side" hidden={collapsed}>
            {panel}
          </aside>
        )}
        {!isPhone && (
          <button
            type="button"
            className="side-toggle icon-button"
            aria-controls="studio-side"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Show route details" : "Hide route details"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}

        <div className="studio-map-wrap" data-tour="map">
          <p className="visually-hidden" aria-live="polite">{summary}</p>
          <StudioMap
            waypoints={studio.waypoints}
            route={route}
            pending={studio.pending}
            draw={draw}
            layer={layer}
            activeD={studio.activeD}
            fitKey={fitKey === "init" ? `init-${route ? "route" : "points"}` : fitKey}
            bottomInset={isPhone ? 190 : route ? 260 : 48}
            onActiveChange={studio.setActiveD}
            onAdd={(point) => studio.addWaypoint(point)}
            onMove={studio.moveWaypoint}
            onReady={onReady}
          />

          <div className="studio-toolbar" role="toolbar" aria-label="Map tools" data-tour="toolbar">
            <button type="button" className={`tool${draw ? " active" : ""}`} aria-pressed={draw} onClick={() => setDraw(!draw)} title="Draw: click the map to add waypoints">
              <PenLine size={18} /> <span>Draw</span>
            </button>
            <button type="button" className={`tool${studio.snap ? " active" : ""}`} aria-pressed={studio.snap} onClick={() => studio.setSnap(!studio.snap)} title="Snap the line to roads and paths">
              <Magnet size={18} /> <span>Snap</span>
            </button>
            <button
              type="button"
              className="tool"
              onClick={() => {
                if (isPhone) setSheet("full");
                setTimeout(() => searchBox.current?.querySelector("input")?.focus(), 50);
              }}
              title="Add a waypoint by searching for a place"
            >
              <MapPin size={18} /> <span>Waypoint</span>
            </button>
            <button type="button" className={`tool${layer === "topo" ? " active" : ""}`} aria-pressed={layer === "topo"} onClick={() => setLayer(layer === "map" ? "topo" : "map")} title="Switch between the map and a topographic layer">
              <Layers size={18} /> <span>{layer === "topo" ? "Topo" : "Layers"}</span>
            </button>
            <button type="button" className="tool" onClick={studio.undo} disabled={!studio.canUndo} title="Undo (Ctrl+Z)">
              <Undo2 size={18} /> <span>Undo</span>
            </button>
            <button type="button" className="tool hide-sm" onClick={() => void save()} title="Save">
              <Save size={18} /> <span>Save</span>
            </button>
            <button type="button" className="tool hide-sm" onClick={() => void exportGpx()} title="Export GPX">
              <Download size={18} /> <span>Export</span>
            </button>
          </div>

          <div className="studio-zoom" role="group" aria-label="Zoom">
            <button type="button" className="icon-button" onClick={() => map.current?.zoomIn()} aria-label="Zoom in">
              <Plus size={18} />
            </button>
            <button type="button" className="icon-button" onClick={() => map.current?.zoomOut()} aria-label="Zoom out">
              <Minus size={18} />
            </button>
            <label className="snap-toggle">
              <input type="checkbox" checked={studio.snap} onChange={(e) => studio.setSnap(e.target.checked)} />
              Snap to road
            </label>
          </div>

          {!isPhone && <ElevationPanel studio={studio} />}
          {!isPhone && assistant?.(studio)}
        </div>
      </div>

      {isPhone && (
        <BottomSheet
          snap={sheet}
          onSnapChange={setSheet}
          label="Route details"
          peek={<Metrics route={route} fitness={studio.fitness} />}
        >
          {panel}
        </BottomSheet>
      )}
    </div>
  );
}
