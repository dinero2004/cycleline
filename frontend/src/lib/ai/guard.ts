/**
 * Defences for the assistant: clean untrusted text before the model sees it, and make sure
 * the model's reply contains no coordinates it didn't get from a tool.
 */

/** Strips control characters and markup-ish brackets from place/POI names and caps the length. */
export function cleanName(text: string, max = 120): string {
  return text
    .replace(/[\u0000-\u001f\u007f<>`{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// Decimal numbers with 3+ decimals, optionally signed, e.g. 47.3769 or -122.4194.
const COORDINATE = /-?\b\d{1,3}\.\d{3,}\b/g;

/** Coordinate-like numbers in text. */
export function coordinateLikeNumbers(text: string): string[] {
  return text.match(COORDINATE) ?? [];
}

/** Records every number in a tool result so the reply check can tell sourced numbers from invented ones. */
export function rememberNumbers(target: Set<string>, text: string) {
  for (const n of coordinateLikeNumbers(text)) target.add(trimNumber(n));
}

const trimNumber = (n: string) => String(Math.round(Number(n) * 1e4) / 1e4);

/** Numbers in the reply that look like coordinates and did not come from a tool result. */
export function inventedCoordinates(reply: string, sourced: Set<string>): string[] {
  return coordinateLikeNumbers(reply).filter((n) => !sourced.has(trimNumber(n)));
}

/** Replaces invented coordinates in streamed text. */
export function redactCoordinates(text: string, sourced: Set<string>): string {
  return text.replace(COORDINATE, (n) => (sourced.has(trimNumber(n)) ? n : "[location]"));
}
