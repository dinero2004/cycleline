import type { StudioDraft } from "@/lib/studio";

/** Guest drafts live only in this browser (localStorage) until the guest creates an account. */
const KEY = "cycleline-guest-drafts";
const MAX_DRAFTS = 10;

export interface GuestDraft extends StudioDraft {
  id: string;
}

export function loadDrafts(): GuestDraft[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]") as GuestDraft[];
    return Array.isArray(value) ? value.filter((d) => d && Array.isArray(d.waypoints)) : [];
  } catch {
    return [];
  }
}

export function saveDraft(draft: GuestDraft) {
  try {
    const others = loadDrafts().filter((d) => d.id !== draft.id);
    localStorage.setItem(KEY, JSON.stringify([draft, ...others].slice(0, MAX_DRAFTS)));
  } catch {
    // Storage full or blocked: the draft only lives in this tab.
  }
}

export function removeDrafts(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadDrafts().filter((d) => !ids.includes(d.id))));
  } catch {
    // Nothing to clean up.
  }
}

/** Drafts worth importing into a new account: at least a start and a finish. */
export function importableDrafts(): GuestDraft[] {
  return loadDrafts().filter((d) => d.waypoints.length >= 2);
}
