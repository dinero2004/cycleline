"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { LatLng } from "@/lib/routing/types";

interface Place {
  name: string;
  label: string;
  coordinates: LatLng;
}

/**
 * Place search with autocomplete (ARIA combobox). Picking a place calls onPick.
 * With `value` the field shows the place it stands for (start, destination) and keeps it after a pick;
 * without it the field empties after each pick (adding stops).
 */
export function PlaceSearch({
  label,
  placeholder,
  onPick,
  value,
  icon,
  action,
}: {
  label: string;
  placeholder: string;
  onPick: (place: Place) => void;
  value?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  const [query, setQuery] = useState(value ?? "");
  const [shownValue, setShownValue] = useState(value);
  // Only what the rider types is searched; a value set from outside is just shown.
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const id = useId();

  if (value !== shownValue) {
    setShownValue(value);
    setQuery(value ?? "");
  }

  useEffect(() => {
    const q = search.trim();
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
  }, [search]);

  function pick(place: Place) {
    setSearch("");
    setOpen(false);
    setResults([]);
    setMessage(null);
    setQuery(value === undefined ? "" : place.name);
    onPick(place);
  }

  return (
    <div className="place-search">
      <label htmlFor={`${id}-input`} className="visually-hidden">
        {label}
      </label>
      <div className={`place-search-field${action ? " has-action" : ""}`}>
        <span className="place-search-icon" aria-hidden="true">
          {loading ? <LoaderCircle size={16} className="spin" /> : (icon ?? <Search size={16} />)}
        </span>
        <input
          id={`${id}-input`}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          aria-describedby={message ? `${id}-message` : undefined}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearch(event.target.value);
            if (event.target.value.trim().length < 3) {
              setResults([]);
              setMessage(null);
            }
          }}
          onFocus={(event) => {
            if (results.length) setOpen(true);
            else if (value !== undefined) event.currentTarget.select();
          }}
          onBlur={() =>
            setTimeout(() => {
              setOpen(false);
              // Leaving the field without picking puts the current place back.
              if (value !== undefined) setQuery((typed) => (typed.trim() ? typed : value));
            }, 150)
          }
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
        {action}
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
        <p id={`${id}-message`} className="place-search-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
