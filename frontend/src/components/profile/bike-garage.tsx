"use client";

import { Bike as BikeIcon, CheckCircle2, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { addBikeAction, deleteBikeAction, setDefaultBikeAction, type ActionState } from "@/app/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import type { Bike } from "@/types";
import { useActionToast } from "./use-action-toast";

const initialState: ActionState = { ok: false, message: "" };

const TYPES: { value: Bike["type"]; label: string }[] = [
  { value: "road", label: "Road" },
  { value: "gravel", label: "Gravel" },
  { value: "mountain", label: "Mountain" },
  { value: "city", label: "City" },
  { value: "electric", label: "Electric" },
  { value: "touring", label: "Touring" },
];

const typeLabel = (type: Bike["type"]) => TYPES.find((t) => t.value === type)?.label ?? type;

export function BikeGarage({ bikes }: { bikes: Bike[] }) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Bike | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, formAction, saving] = useActionState(addBikeAction, initialState);
  useActionToast(state, () => setAdding(false));

  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <section className="card" aria-labelledby="garage-title">
      <header className="card-header">
        <div>
          <h2 id="garage-title" className="card-title">
            Bike garage
          </h2>
          <p className="card-description">Your default bike sets the planner&apos;s riding profile.</p>
        </div>
        {!adding && (
          <button type="button" className="button button-secondary button-small" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden="true" /> Add a bike
          </button>
        )}
      </header>

      {bikes.length ? (
        <ul className="bike-list">
          {bikes.map((bike) => (
            <li key={bike.id} className="bike-row">
              <span className="bike-row-icon" aria-hidden="true">
                <BikeIcon size={20} />
              </span>
              <div className="bike-row-text">
                <strong>{bike.name}</strong>
                <span>
                  {typeLabel(bike.type)}
                  {bike.weight_kg ? ` · ${Number(bike.weight_kg)} kg` : ""}
                  {bike.notes ? ` · ${bike.notes}` : ""}
                </span>
              </div>
              <div className="bike-row-actions">
                {bike.is_default ? (
                  <span className="pill">
                    <CheckCircle2 size={14} aria-hidden="true" /> Default
                  </span>
                ) : (
                  <button type="button" className="link-button" disabled={pending} onClick={() => run(() => setDefaultBikeAction(bike.id))}>
                    Make default
                  </button>
                )}
                <button type="button" className="icon-button danger" onClick={() => setRemoving(bike)} aria-label={`Remove ${bike.name}`}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        !adding && (
          <div className="empty-inline">
            <BikeIcon size={22} aria-hidden="true" />
            <p>No bikes yet. Add one so the planner picks a matching route profile.</p>
          </div>
        )
      )}

      {adding && (
        <form action={formAction} className="stack-form add-bike">
          <div className="two-column-fields">
            <Field label="Name" name="name" placeholder="e.g. Moss" required minLength={2} maxLength={80} autoFocus />
            <label className="field">
              <span className="field-label">Type</span>
              <select name="type" defaultValue="gravel">
                {TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="two-column-fields">
            <label className="field">
              <span className="field-label">Weight (optional)</span>
              <span className="input-with-unit">
                <input name="weight_kg" type="number" inputMode="decimal" min="3" max="40" step="0.1" placeholder="9.4" />
                <span>kg</span>
              </span>
            </label>
            <Field label="Notes (optional)" name="notes" placeholder="Tyres, setup…" maxLength={500} />
          </div>
          <label className="check-label">
            <input type="checkbox" name="is_default" defaultChecked={!bikes.length} />
            <span>Use as my default bike</span>
          </label>
          <div className="button-row">
            <button className="button button-primary" disabled={saving} aria-busy={saving}>
              {saving && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
              {saving ? "Adding…" : "Add bike"}
            </button>
            <button type="button" className="button button-ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog open={removing !== null} title={`Remove ${removing?.name ?? "this bike"}?`} onClose={() => setRemoving(null)}>
        <p>Saved routes keep their distance and climbing, but lose the link to this bike.</p>
        <div className="button-row">
          <button type="button" className="button button-ghost" onClick={() => setRemoving(null)}>
            Keep it
          </button>
          <button
            type="button"
            className="button button-danger"
            disabled={pending}
            onClick={() => {
              const bike = removing;
              setRemoving(null);
              if (bike) run(() => deleteBikeAction(bike.id));
            }}
          >
            Remove bike
          </button>
        </div>
      </ConfirmDialog>
    </section>
  );
}
