"use client";

import { LoaderCircle, Send, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SurfaceBar } from "@/components/viz/surface-bar";
import type { AssistantEvent, RouteCard } from "@/lib/ai/types";
import { estimateDurationS, formatDuration } from "@/lib/routing/metrics";
import type { GateReason } from "./route-studio";
import type { Studio } from "./use-studio";

interface ChatItem {
  role: "user" | "assistant";
  text: string;
  tools: { name: string; label: string; status: "running" | "done" | "error" }[];
  routes: RouteCard[];
  error?: string;
}

const STARTERS = [
  "A 40 km gravel loop from here with under 500 m of climbing",
  "Quietest way to my finish",
  "Add a coffee stop",
];

/** Leading-zero bits of a SHA-256 digest. */
function zeroBits(bytes: Uint8Array) {
  let bits = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

/** Solves the guest proof-of-work in small async batches so the page stays responsive. */
async function solveChallenge(): Promise<{ challenge: string; nonce: string }> {
  const { challenge, difficulty } = (await (await fetch("/api/assistant/challenge")).json()) as { challenge: string; difficulty: number };
  const encoder = new TextEncoder();
  for (let n = 0; ; n++) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(challenge + n)));
    if (zeroBits(digest) >= difficulty) return { challenge, nonce: String(n) };
    if (n % 2000 === 0) await new Promise((resolve) => setTimeout(resolve));
  }
}

function parseEvents(buffer: string): { events: AssistantEvent[]; rest: string } {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events = blocks.flatMap((block) => {
    const line = block.split("\n").find((l) => l.startsWith("data:"));
    if (!line) return [];
    try {
      return [JSON.parse(line.slice(5)) as AssistantEvent];
    } catch {
      return [];
    }
  });
  return { events, rest };
}

/** Route assistant chat. Desktop: a floating panel over the map. Phones: a section in the bottom sheet. */
export function AssistantPanel({
  studio,
  mode,
  onGate,
  inline = false,
}: {
  studio: Studio;
  mode: "member" | "guest";
  onGate?: (reason: GateReason) => void;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(inline);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationId = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  const pow = useRef<Promise<{ challenge: string; nonce: string }> | null>(null);
  const list = useRef<HTMLOListElement>(null);

  // Guests: start the bot check as soon as the panel opens, so the first send isn't delayed.
  useEffect(() => {
    if (open && mode === "guest" && !pow.current && !conversationId.current) pow.current = solveChallenge().catch(() => ({ challenge: "", nonce: "" }));
  }, [open, mode]);

  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: "end" });
  }, [items]);

  function update(fn: (item: ChatItem) => ChatItem) {
    setItems((current) => [...current.slice(0, -1), fn(current[current.length - 1])]);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setDraft("");
    setBusy(true);
    setItems((current) => [...current, { role: "user", text: message, tools: [], routes: [] }, { role: "assistant", text: "", tools: [], routes: [] }]);
    const controller = new AbortController();
    abort.current = controller;

    try {
      const proof = !conversationId.current && mode === "guest" ? await pow.current : undefined;
      pow.current = null;
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          conversationId: conversationId.current,
          pow: proof?.challenge ? proof : undefined,
          context: {
            waypoints: studio.waypoints.map((w) => ({ label: w.label, point: w.point })),
            profile: studio.profile,
            fitness: studio.fitness,
          },
        }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: { code: string; message: string } };
        if (data.error?.code === "rate_limited" && mode === "guest") onGate?.("quota");
        update((item) => ({ ...item, error: data.error?.message ?? "The assistant is unavailable right now." }));
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = parseEvents(buffer + value);
        buffer = parsed.rest;
        for (const event of parsed.events) {
          if (event.type === "start") conversationId.current = event.conversationId;
          else if (event.type === "text") update((item) => ({ ...item, text: item.text + event.delta }));
          else if (event.type === "tool")
            update((item) => {
              const others = item.tools.filter((t) => !(t.name === event.name && t.status === "running"));
              return { ...item, tools: [...others, { name: event.name, label: event.label, status: event.status }] };
            });
          else if (event.type === "routes") {
            update((item) => ({ ...item, routes: [...item.routes, ...event.routes] }));
            // Draw the top option right away; the others are one tap away.
            if (event.routes[0]) studio.showRoute(event.routes[0].route);
          } else if (event.type === "signup") onGate?.("save");
          else if (event.type === "error") update((item) => ({ ...item, error: event.message }));
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") update((item) => ({ ...item, text: `${item.text}${item.text ? " " : ""}(stopped)` }));
      else update((item) => ({ ...item, error: "The connection dropped. Try again." }));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  if (!open) {
    return (
      <button type="button" className="assistant-fab button button-primary" onClick={() => setOpen(true)} data-tour="assistant">
        <Sparkles size={17} /> Ask the route assistant
      </button>
    );
  }

  return (
    <section className={`assistant-panel${inline ? " inline" : ""}`} aria-labelledby="assistant-title" data-tour="assistant">
      <header className="assistant-head">
        <h3 id="assistant-title">
          <Sparkles size={16} aria-hidden="true" /> Route assistant
        </h3>
        {!inline && (
          <button type="button" className="icon-button small" onClick={() => setOpen(false)} aria-label="Close the assistant">
            <X size={16} />
          </button>
        )}
      </header>

      <ol className="assistant-log" ref={list} aria-live="polite">
        {items.length === 0 && (
          <li className="assistant-intro">
            <p>Describe the ride you want. I plan with real map data and never make up routes.</p>
            <div className="starter-row">
              {STARTERS.map((s) => (
                <button key={s} type="button" className="starter" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </li>
        )}
        {items.map((item, i) => (
          <li key={i} className={`chat-${item.role}`}>
            {item.tools.length > 0 && (
              <ul className="tool-chips" aria-label="Steps">
                {item.tools.map((t, j) => (
                  <li key={j} className={`tool-chip ${t.status}`}>
                    {t.status === "running" && <LoaderCircle size={12} className="spin" aria-hidden="true" />}
                    {t.label}
                  </li>
                ))}
              </ul>
            )}
            {item.text && <p className="chat-text">{item.text}</p>}
            {item.role === "assistant" && busy && i === items.length - 1 && !item.text && !item.tools.length && (
              <p className="chat-text muted">Thinking…</p>
            )}
            {item.routes.length > 0 && (
              <ul className="assistant-cards">
                {item.routes.map((card) => {
                  const selected = studio.route?.id === card.route.id;
                  return (
                    <li key={card.route.id}>
                      <button type="button" className={`candidate${selected ? " selected" : ""}`} aria-pressed={selected} onClick={() => studio.showRoute(card.route)}>
                        <span className="candidate-head">
                          <strong>Option {card.rank}</strong>
                          <span>
                            {(card.route.distanceM / 1000).toFixed(1)} km · +{card.route.ascentM} m ·{" "}
                            {formatDuration(estimateDurationS(card.route, studio.fitness))}
                          </span>
                        </span>
                        <SurfaceBar mix={card.route.surfaceMix} inferredM={card.route.inferredSurfaceM} compact />
                        <span className="candidate-why">{card.why}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {item.error && (
              <p className="chat-error" role="alert">
                {item.error}
              </p>
            )}
          </li>
        ))}
      </ol>

      <form
        className="assistant-input"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <label htmlFor="assistant-message" className="visually-hidden">
          Message the route assistant
        </label>
        <textarea
          id="assistant-message"
          rows={2}
          maxLength={1000}
          enterKeyHint="send"
          placeholder="e.g. 60 km gravel loop, under 800 m of climbing"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
        />
        {busy ? (
          <button type="button" className="icon-button" onClick={() => abort.current?.abort()} aria-label="Stop the answer">
            <Square size={16} />
          </button>
        ) : (
          <button type="submit" className="icon-button send" disabled={!draft.trim()} aria-label="Send">
            <Send size={16} />
          </button>
        )}
      </form>
      <p className="assistant-foot">AI can be wrong about conditions. Check closures and the weather before you ride.</p>
    </section>
  );
}
