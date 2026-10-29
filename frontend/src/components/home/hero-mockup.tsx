"use client";

import { useState } from "react";
import { ElevationChart } from "@/components/viz/elevation-chart";
import { RouteShape } from "@/components/viz/route-shape";
import { SurfaceBar } from "@/components/viz/surface-bar";
import type { SampleRoute } from "@/data/samples";
import { difficulty, estimateDurationS, formatDuration, pointAtDistance, surfacePercentages } from "@/lib/routing/metrics";

/** Tilted product preview built from a real route; hovering the chart moves the marker on the map. */
export function HeroMockup({ sample }: { sample: SampleRoute }) {
  const { route } = sample;
  const [activeD, setActiveD] = useState<number | null>(null);
  const marker = activeD === null ? null : pointAtDistance(route, activeD);
  const pct = surfacePercentages(route.surfaceMix);

  return (
    <div className="hero-mockup-wrap">
      <div className="hero-mockup" aria-label={`Preview of Route Studio showing ${sample.name}`} role="group">
        <div className="mockup-bar">
          <span className="mockup-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="eyebrow">Route studio</span>
          <strong>{sample.name}</strong>
        </div>
        <div className="mockup-body">
          <aside className="mockup-side">
            <dl className="mockup-metrics">
              <div>
                <dt>Distance</dt>
                <dd>{(route.distanceM / 1000).toFixed(1)} <small>km</small></dd>
              </div>
              <div>
                <dt>Climb</dt>
                <dd>{route.ascentM} <small>m</small></dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{formatDuration(estimateDurationS(route, "intermediate"))}</dd>
              </div>
              <div>
                <dt>Difficulty</dt>
                <dd className="capitalize">{difficulty(route).level}</dd>
              </div>
            </dl>
            <SurfaceBar mix={route.surfaceMix} inferredM={route.inferredSurfaceM} compact />
          </aside>
          <div className="mockup-map">
            <svg className="contours" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              {[30, 58, 86, 114, 142, 170].map((r) => (
                <ellipse key={r} cx="250" cy="120" rx={r * 1.35} ry={r} />
              ))}
              {[24, 48, 72].map((r) => (
                <ellipse key={`b${r}`} cx="80" cy="210" rx={r * 1.2} ry={r * 0.8} />
              ))}
            </svg>
            <RouteShape coordinates={route.geometry.coordinates} width={400} height={260} marker={marker} />
          </div>
        </div>
        <div className="mockup-chart">
          <ElevationChart
            points={route.elevation}
            segments={route.segments}
            activeD={activeD}
            onActiveChange={setActiveD}
            height={86}
            showAxis={false}
            label={`Elevation profile of ${sample.name}`}
          />
        </div>
      </div>
      <div className="stat-chip chip-a" aria-hidden="true">
        <span className="eyebrow">Max grade</span>
        <strong>{route.maxGradePct}%</strong>
      </div>
      <div className="stat-chip chip-b" aria-hidden="true">
        <span className="eyebrow">Surface</span>
        <strong>{pct.paved}% paved</strong>
      </div>
    </div>
  );
}
