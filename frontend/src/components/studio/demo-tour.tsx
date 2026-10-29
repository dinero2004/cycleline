"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    target: "map",
    title: "Draw on the map",
    body: "Click the map (or press and hold on a phone) to add waypoints. The line snaps to rideable roads and paths. Drag a marker to move it.",
  },
  {
    target: "toolbar",
    title: "Your tools",
    body: "Switch drawing and snap-to-road on or off, add a waypoint by searching, change the map layer, or undo.",
  },
  {
    target: "studio",
    title: "Know the ride",
    body: "Distance, climbing, ride time for your fitness and the surface mix update as you draw. Move along the elevation chart to see that point on the map.",
  },
  {
    target: "assistant",
    title: "Ask the assistant",
    body: "Describe a ride, like “40 km gravel loop, not too hilly”. It plans with real map data and shows options you can draw with one tap.",
  },
  {
    target: "export",
    title: "Take it with you",
    body: "Export a GPX for Garmin, Wahoo or Hammerhead. With a free account you can also save routes and your demo drafts come with you.",
  },
];

/** Short skippable tour for the guest demo. Highlights the real control; Esc skips. */
export function DemoTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  useEffect(() => {
    const find = () =>
      [...document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)].find((el) => el.getClientRects().length > 0) ?? null;
    const measure = () => setRect(find()?.getBoundingClientRect() ?? null);
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    card.current?.focus();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Large targets (the map, the studio) are outlined; the card sits centred near the bottom.
  const big = rect && rect.width * rect.height > window.innerWidth * window.innerHeight * 0.3;
  const style: React.CSSProperties | undefined =
    rect && !big
      ? rect.bottom + 230 < window.innerHeight
        ? { top: rect.bottom + 14, left: Math.min(Math.max(12, rect.left), window.innerWidth - 352) }
        : { bottom: window.innerHeight - rect.top + 14, left: Math.min(Math.max(12, rect.left), window.innerWidth - 352) }
      : undefined;

  return (
    <div className="demo-tour" role="presentation">
      {rect && (
        <div
          className="tour-spot"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
          aria-hidden="true"
        />
      )}
      <div ref={card} className={`tour-card${style ? "" : " centered"}`} style={style} role="dialog" aria-modal="true" aria-labelledby="tour-title" tabIndex={-1}>
        <p className="eyebrow">
          Step {index + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          {!last && (
            <button type="button" className="link-button" onClick={onClose}>
              Skip tour
            </button>
          )}
          <span className="tour-spacer" />
          {index > 0 && (
            <button type="button" className="button button-secondary button-small" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          )}
          <button
            type="button"
            className="button button-primary button-small"
            onClick={() => (last ? onClose() : setIndex(index + 1))}
          >
            {last ? "Start riding" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
