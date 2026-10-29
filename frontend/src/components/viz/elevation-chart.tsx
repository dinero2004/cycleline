"use client";

import { useId, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { formatM } from "@/lib/routing/metrics";
import type { ElevationPoint, RouteSegment } from "@/lib/routing/types";

const W = 1000;

export type GradeBand = "easy" | "moderate" | "steep";
export const gradeBand = (pct: number): GradeBand => (pct > 8 ? "steep" : pct >= 4 ? "moderate" : "easy");

function elevationAtD(points: ElevationPoint[], d: number) {
  const i = points.findIndex((p) => p.d >= d);
  if (i <= 0) return i === 0 ? points[0].e : points[points.length - 1].e;
  const a = points[i - 1];
  const b = points[i];
  return a.e + ((b.e - a.e) * (d - a.d)) / Math.max(1, b.d - a.d);
}

/**
 * Elevation profile: 2.5px line over a gradient fill, optional grade colouring and surface strip.
 * Pointer, touch and keyboard all move the active position; onActiveChange links it to the map.
 */
export function ElevationChart({
  points,
  segments = [],
  activeD = null,
  onActiveChange,
  height = 140,
  showGrade = true,
  showAxis = true,
  showSurfaceStrip = true,
  label = "Elevation profile",
}: {
  points: ElevationPoint[];
  segments?: RouteSegment[];
  activeD?: number | null;
  onActiveChange?: (d: number | null) => void;
  height?: number;
  showGrade?: boolean;
  showAxis?: boolean;
  showSurfaceStrip?: boolean;
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const box = useRef<SVGSVGElement>(null);
  if (points.length < 2) return null;

  const total = points[points.length - 1].d || 1;
  const min = Math.min(...points.map((p) => p.e));
  const max = Math.max(...points.map((p) => p.e));
  const range = Math.max(20, max - min);
  const top = 10;
  const bottom = height - (showSurfaceStrip ? 14 : 4);
  const x = (d: number) => (d / total) * W;
  const y = (e: number) => bottom - ((e - min) / range) * (bottom - top);

  const line = points.map((p) => `${x(p.d).toFixed(1)},${y(p.e).toFixed(1)}`).join(" ");
  const area = `M0,${bottom} L${line.replace(/ /g, " L")} L${W},${bottom} Z`;

  // Grade-coloured overlay: one polyline per run of points in the same grade band.
  const runs: { band: GradeBand; pts: string[] }[] = [];
  if (showGrade) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const band = gradeBand(((b.e - a.e) / Math.max(1, b.d - a.d)) * 100);
      const pa = `${x(a.d).toFixed(1)},${y(a.e).toFixed(1)}`;
      const pb = `${x(b.d).toFixed(1)},${y(b.e).toFixed(1)}`;
      const last = runs[runs.length - 1];
      if (last && last.band === band) last.pts.push(pb);
      else runs.push({ band, pts: [pa, pb] });
    }
  }

  function fromClientX(clientX: number) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || !rect.width) return null;
    return Math.max(0, Math.min(total, ((clientX - rect.left) / rect.width) * total));
  }

  function onPointer(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerType === "mouse" || event.buttons || event.type === "pointerdown") {
      onActiveChange?.(fromClientX(event.clientX));
    }
  }

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    const step = total / 100;
    const current = activeD ?? 0;
    const next =
      event.key === "ArrowRight" ? current + step
      : event.key === "ArrowLeft" ? current - step
      : event.key === "PageUp" ? current + step * 10
      : event.key === "PageDown" ? current - step * 10
      : event.key === "Home" ? 0
      : event.key === "End" ? total
      : null;
    if (next === null) return;
    event.preventDefault();
    onActiveChange?.(Math.max(0, Math.min(total, next)));
  }

  const active = activeD === null ? null : { d: activeD, e: elevationAtD(points, activeD) };
  const activeSegment = active ? segments.find((s) => active.d >= s.startM && active.d <= s.endM) : undefined;
  const readout = active
    ? `${formatM(active.d)} · ${Math.round(active.e)} m${activeSegment ? ` · ${activeSegment.gradePct > 0 ? "+" : ""}${activeSegment.gradePct}%` : ""}`
    : null;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * total);

  return (
    <figure className="elevation-chart">
      <div className="elevation-plot">
        <svg
          ref={box}
          viewBox={`0 0 ${W} ${height}`}
          preserveAspectRatio="none"
          style={{ height }}
          tabIndex={onActiveChange ? 0 : undefined}
          role="slider"
          aria-label={`${label}. Use arrow keys to move along the route.`}
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(active?.d ?? 0)}
          aria-valuetext={readout ?? "Start of the route"}
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerLeave={(event) => event.pointerType === "mouse" && onActiveChange?.(null)}
          onKeyDown={onKey}
        >
          <defs>
            <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="elevation-fill-top" />
              <stop offset="100%" className="elevation-fill-bottom" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#fill-${id})`} />
          <polyline className="elevation-line" points={line} />
          {runs
            .filter((r) => r.band !== "easy")
            .map((r, i) => (
              <polyline key={i} className={`elevation-grade grade-${r.band}`} points={r.pts.join(" ")} />
            ))}
          {showSurfaceStrip &&
            segments.map((s, i) => (
              <rect
                key={i}
                className={`surface-${s.surface}`}
                x={x(s.startM)}
                y={height - 8}
                width={Math.max(0.5, x(s.endM) - x(s.startM))}
                height={8}
              />
            ))}
          {active && <line className="elevation-cursor" x1={x(active.d)} x2={x(active.d)} y1={0} y2={bottom} />}
        </svg>
        {active && (
          <span
            className="elevation-readout"
            style={{ left: `${Math.min(88, Math.max(12, (active.d / total) * 100))}%` }}
            aria-hidden="true"
          >
            {readout}
          </span>
        )}
      </div>
      {showAxis && (
        <div className="elevation-axis" aria-hidden="true">
          {ticks.map((d) => (
            <span key={d}>{formatM(d)}</span>
          ))}
        </div>
      )}
      <figcaption className="visually-hidden">
        {label}: from {Math.round(points[0].e)} m to {Math.round(points[points.length - 1].e)} m, lowest {Math.round(min)} m,
        highest {Math.round(max)} m over {formatM(total)}.
      </figcaption>
    </figure>
  );
}
