import { formatM, surfacePercentages } from "@/lib/routing/metrics";
import { SURFACES, type Surface } from "@/lib/routing/types";

export const SURFACE_LABEL: Record<Surface, string> = {
  paved: "Paved",
  gravel: "Gravel",
  trail: "Trail",
  unknown: "Unknown",
};

/** Plain-language summary for screen readers and the AI. */
export function surfaceSummary(mix: Record<Surface, number>, inferredM = 0): string {
  const pct = surfacePercentages(mix);
  const parts = SURFACES.filter((s) => pct[s] > 0).map((s) => `${pct[s]}% ${SURFACE_LABEL[s].toLowerCase()}`);
  const inferred = inferredM > 0 ? ` ${formatM(inferredM)} of that is inferred from the road type, not tagged.` : "";
  return `Surface: ${parts.join(", ") || "no data"}.${inferred}`;
}

/** Stacked surface bar. Each surface has its own pattern too, so colour is not the only cue. */
export function SurfaceBar({
  mix,
  inferredM = 0,
  legend = true,
  compact = false,
}: {
  mix: Record<Surface, number>;
  inferredM?: number;
  legend?: boolean;
  compact?: boolean;
}) {
  const pct = surfacePercentages(mix);
  const shown = SURFACES.filter((s) => pct[s] > 0);

  return (
    <div className={`surface-mix${compact ? " compact" : ""}`}>
      <div className="surface-bar" aria-hidden="true">
        {shown.map((s) => (
          <span key={s} className={`surface-${s}`} style={{ flexGrow: mix[s] }} />
        ))}
      </div>
      {legend && (
        <ul className="surface-legend" aria-hidden="true">
          {shown.map((s) => (
            <li key={s}>
              <span className={`surface-swatch surface-${s}`} />
              {SURFACE_LABEL[s]} <strong>{pct[s]}%</strong>
            </li>
          ))}
        </ul>
      )}
      <p className="visually-hidden">{surfaceSummary(mix, inferredM)}</p>
    </div>
  );
}
