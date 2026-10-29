"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { HelpCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SAMPLE_ROUTES } from "@/data/samples";
import { loadDrafts, saveDraft, type GuestDraft } from "@/lib/guest-drafts";
import { decodeShare, waypointId, type StudioDraft } from "@/lib/studio";
import type { Fitness } from "@/lib/routing/types";
import { DemoTour } from "./demo-tour";
import { RouteStudio, type GateReason } from "./route-studio";
import type { StudioInit } from "./use-studio";

const AssistantPanel = dynamic(() => import("./assistant-panel").then((m) => m.AssistantPanel), { ssr: false });

const TOUR_KEY = "cycleline-demo-tour-done";

const GATE_COPY: Record<GateReason, { title: string; body: string }> = {
  save: {
    title: "Keep this route",
    body: "Create a free account to save routes to your library. Your demo drafts come with you.",
  },
  export: {
    title: "Your GPX is downloading",
    body: "Demo exports carry a short note in the file. With a free account, exports are clean and saved routes stay one tap away.",
  },
  share: {
    title: "Link copied",
    body: "Anyone with the link sees the same waypoints. A free account also keeps the route in your library.",
  },
  quota: {
    title: "That's the demo for today",
    body: "You've used today's demo routes or assistant messages. A free account has much higher limits, and your drafts move over.",
  },
};

interface Limits {
  routesPerDay: number;
  maxRouteKm: number;
  aiMessagesPerDay: number;
}

function sampleInit(fitness: Fitness): StudioInit {
  const sample = SAMPLE_ROUTES[0];
  return {
    name: sample.name,
    profile: sample.profile,
    waypoints: sample.route.waypoints.map((point, i, all) => ({
      id: waypointId(),
      point,
      label: i === 0 ? sample.startName : i === all.length - 1 ? sample.endName : undefined,
    })),
    route: sample.route,
    fitness,
  };
}

/** Starting plan: a shared link, the last draft on this device, or a real sample route. */
function initialPlan(params: { w?: string; p?: string; n?: string }): { init: StudioInit; draftId: string } {
  const fitness: Fitness = "intermediate";
  const shared = decodeShare(params);
  if (shared) return { init: { name: shared.name ?? "", waypoints: shared.waypoints, profile: shared.profile, fitness }, draftId: waypointId() };
  const [d] = loadDrafts();
  if (d) {
    return {
      init: { name: d.name, waypoints: d.waypoints, profile: d.profile, preferences: d.preferences, snap: d.snap, route: d.route, fitness },
      draftId: d.id,
    };
  }
  // First visit: start from a real sample route so the studio is never empty.
  return { init: sampleInit(fitness), draftId: waypointId() };
}

function tourSeen() {
  try {
    return Boolean(localStorage.getItem(TOUR_KEY));
  } catch {
    return false;
  }
}

/**
 * Route Studio for guests: no account, drafts in this browser, kind limits, a short tour.
 * Client-only (reads localStorage); the page loads it through guest-studio-loader.
 */
export default function GuestStudio({ params }: { params: { w?: string; p?: string; n?: string } }) {
  const [{ init, draftId: firstDraftId }] = useState(() => initialPlan(params));
  const [limits, setLimits] = useState<Limits | null>(null);
  const [tour, setTour] = useState(() => !tourSeen());
  const [gate, setGate] = useState<GateReason | null>(null);
  const [bannerOpen, setBannerOpen] = useState(true);
  const draftId = useRef(firstDraftId);
  const dialog = useRef<HTMLDialogElement>(null);
  const shown = useRef(new Set<GateReason>());

  useEffect(() => {
    // Anonymous signed id for rate limits and quotas.
    fetch("/api/guest", { method: "POST" })
      .then((r) => r.json())
      .then((data: { limits: Limits }) => setLimits(data.limits))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (gate) dialog.current?.showModal();
  }, [gate]);

  const onGate = useCallback((reason: GateReason) => {
    // Nudge once per kind of moment and session; never block the tool itself.
    if (reason !== "quota" && shown.current.has(reason)) return;
    shown.current.add(reason);
    setGate(reason);
  }, []);

  const onDraftChange = useCallback((draft: StudioDraft) => {
    if (!draft.waypoints.length) return;
    saveDraft({ ...draft, id: draftId.current } as GuestDraft);
  }, []);

  function closeTour() {
    setTour(false);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      // Not remembered; the tour shows again next time.
    }
  }

  const banner = bannerOpen ? (
    <div className="demo-banner" role="note">
      <p>
        <strong>Guest demo</strong>
        <span className="demo-banner-detail"> — no account needed. Drafts stay on this device.</span>
        {limits && (
          <span className="muted">
            {" "}
            Up to {limits.routesPerDay} routes a day, {limits.maxRouteKm} km each, {limits.aiMessagesPerDay} assistant messages.
          </span>
        )}
      </p>
      <button type="button" className="link-button" onClick={() => setTour(true)}>
        <HelpCircle size={15} /> Tour
      </button>
      <Link href="/login?mode=register&from=demo" className="button button-primary button-small">
        Create free account
      </Link>
      <button type="button" className="icon-button small" onClick={() => setBannerOpen(false)} aria-label="Hide the demo banner">
        <X size={15} />
      </button>
    </div>
  ) : null;

  return (
    <>
      <RouteStudio
        mode="guest"
        init={init}
        onGate={onGate}
        onDraftChange={onDraftChange}
        banner={banner}
        assistant={(studio, { inline }) => <AssistantPanel studio={studio} mode="guest" onGate={onGate} inline={inline} />}
      />
      {tour && <DemoTour onClose={closeTour} />}
      <dialog
        ref={dialog}
        className="gate-dialog"
        aria-labelledby="gate-title"
        onClose={() => setGate(null)}
        onClick={(event) => event.target === dialog.current && dialog.current?.close()}
      >
        {gate && (
          <div className="gate-body">
            <h2 id="gate-title">{GATE_COPY[gate].title}</h2>
            <p>{GATE_COPY[gate].body}</p>
            <div className="gate-actions">
              <button type="button" className="button button-secondary button-small" onClick={() => dialog.current?.close()}>
                Keep exploring
              </button>
              <Link href="/login?mode=register&from=demo" className="button button-primary button-small">
                Create free account
              </Link>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
