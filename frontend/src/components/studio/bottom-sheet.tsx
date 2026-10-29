"use client";

import { useRef, useState, type ReactNode } from "react";

export type SheetSnap = "peek" | "half" | "full";
const ORDER: SheetSnap[] = ["peek", "half", "full"];
const LABEL: Record<SheetSnap, string> = { peek: "collapsed", half: "half open", full: "fully open" };

/** Height for each snap point, as a fraction of the available height (peek is a fixed strip). */
function snapHeight(snap: SheetSnap, available: number) {
  return snap === "peek" ? 132 : snap === "half" ? available * 0.52 : available - 12;
}

/**
 * Bottom sheet for phones: drag the handle (or tap it, or use Enter/Space) to move between
 * peek, half and full. The map stays usable above it.
 */
export function BottomSheet({
  snap,
  onSnapChange,
  peek,
  children,
  label,
}: {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  peek: ReactNode;
  children: ReactNode;
  label: string;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startH: number } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const available = () => sheet.current?.parentElement?.clientHeight ?? 700;

  function onPointerDown(event: React.PointerEvent) {
    drag.current = { startY: event.clientY, startH: sheet.current?.offsetHeight ?? 0 };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag.current) return;
    const h = drag.current.startH + (drag.current.startY - event.clientY);
    setDragHeight(Math.max(96, Math.min(available() - 12, h)));
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!drag.current) return;
    const moved = Math.abs(event.clientY - drag.current.startY);
    const h = dragHeight ?? drag.current.startH;
    drag.current = null;
    setDragHeight(null);
    if (moved < 6) {
      // A tap cycles to the next snap point.
      onSnapChange(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]);
      return;
    }
    const avail = available();
    const nearest = ORDER.reduce((best, s) => (Math.abs(snapHeight(s, avail) - h) < Math.abs(snapHeight(best, avail) - h) ? s : best), snap);
    onSnapChange(nearest);
  }

  const height = dragHeight ?? undefined;

  return (
    <div
      ref={sheet}
      className={`bottom-sheet sheet-${snap}${dragHeight !== null ? " is-dragging" : ""}`}
      style={height ? { height } : undefined}
      role="region"
      aria-label={label}
    >
      <button
        type="button"
        className="sheet-handle"
        aria-label={`${label}: ${LABEL[snap]}. Activate to change size.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragHeight(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSnapChange(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]);
          }
        }}
      >
        <span aria-hidden="true" />
      </button>
      <div className="sheet-peek">{peek}</div>
      <div className="sheet-body" hidden={snap === "peek" && dragHeight === null}>
        {children}
      </div>
    </div>
  );
}
