"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { LatLng } from "@/lib/routing/types";

interface Place {
  name: string;
  label: string;
  coordinates: LatLng;
}

/** Place search with autocomplete (ARIA combobox). Picking a place calls onPick. */
export function PlaceSearch({
  label,
  placeholder,
  onPick,
}: {
  label: string;
  placeholder: string;
  onPick: (place: Place) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const id = useId();
  const picked = useRef(false);

  useEffect(() => {
    if (picked.current) {
      picked.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal });
        const data = (await response.json()) as { results?: Place[]; error?: { message: string } };
        setResults(data.results ?? []);
        setMessage(response.ok ? null : data.error?.message ?? "Search failed.");
        setOpen(true);
        setActive(-1);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setMessage("Search is unavailable right now.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function pick(place: Place) {
    picked.current = true;
    setQuery(place.name);
    setOpen(false);
    setResults([]);
    onPick(place);
    setQuery("");
  }

  return (
    <div className="place-search">
      <label htmlFor={`${id}-input`} className="visually-hidden">
        {label}
      </label>
      <div className="place-search-field">
        {loading ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
        <input
          id={`${id}-input`}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim().length < 3) {
              setResults([]);
              setMessage(null);
            }
          }}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (event.key === "Enter" && results.length) {
              event.preventDefault();
              pick(results[Math.max(0, active)]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>
      <ul id={`${id}-list`} role="listbox" className="place-results" hidden={!open || results.length === 0} aria-label={`${label} results`}>
        {results.map((place, i) => (
          <li
            key={`${place.label}-${i}`}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(place)}
          >
            <strong>{place.name}</strong>
            <span>{place.label}</span>
          </li>
        ))}
      </ul>
      {message && (
        <p className="field-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
