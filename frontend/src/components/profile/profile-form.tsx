"use client";

import { LoaderCircle, Mail, UserRound } from "lucide-react";
import { startTransition, useActionState, useRef, useState } from "react";
import { updateProfileAction, type ActionState } from "@/app/actions";
import { Field } from "@/components/ui/field";
import { validateEmail, validateUsername } from "@/lib/forms";
import type { UserProfile } from "@/types";
import { useActionToast } from "./use-action-toast";

const initialState: ActionState = { ok: false, message: "" };

const snapshot = (form: HTMLFormElement | null) => (form ? JSON.stringify([...new FormData(form).entries()]) : "");

/** Account and preferences in two cards; a save bar appears only once something changed. */
export function ProfileForm({ user }: { user: UserProfile }) {
  const form = useRef<HTMLFormElement>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [state, formAction, saving] = useActionState(updateProfileAction, initialState);
  const error = (name: string) => (state.ok ? undefined : state.errors?.[name]?.[0]);

  useActionToast(state, () => {
    setBaseline(snapshot(form.current));
    setDirty(false);
  });

  function track() {
    const base = baseline ?? snapshot(form.current);
    if (baseline === null) setBaseline(base);
    setDirty(snapshot(form.current) !== base);
  }

  return (
    <form
      ref={form}
      className="profile-form"
      // Captured before the first change, so "changed" means changed from what was loaded.
      onFocus={() => baseline === null && setBaseline(snapshot(form.current))}
      onInput={track}
      onChange={track}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <section className="card" aria-labelledby="account-title">
        <header className="card-header">
          <div>
            <h2 id="account-title" className="card-title">
              Account
            </h2>
            <p className="card-description">How you sign in and how other riders see you.</p>
          </div>
        </header>
        <div className="stack-form">
          <div className="two-column-fields">
            <Field
              label="Username"
              name="username"
              icon={<UserRound size={18} />}
              defaultValue={user.username}
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              validate={validateUsername}
              error={error("username")}
              required
            />
            <Field
              label="Email"
              name="email"
              type="email"
              icon={<Mail size={18} />}
              defaultValue={user.email}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              spellCheck={false}
              validate={validateEmail}
              error={error("email")}
              required
            />
          </div>
          <label>
            Short bio
            <textarea name="bio" defaultValue={user.bio ?? ""} maxLength={500} rows={3} placeholder="What kind of rider are you?" />
          </label>
        </div>
      </section>

      <section className="card" aria-labelledby="preferences-title">
        <header className="card-header">
          <div>
            <h2 id="preferences-title" className="card-title">
              Preferences
            </h2>
            <p className="card-description">The planner uses these to judge effort and suggest routes. Distances are in kilometres.</p>
          </div>
        </header>
        <div className="three-column-fields">
          <label className="field">
            <span className="field-label">Fitness</span>
            <select name="fitness_level" defaultValue={user.fitness_level}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Weekly goal</span>
            <span className="input-with-unit">
              <input name="weekly_distance_goal" type="number" inputMode="numeric" min="10" max="1000" defaultValue={user.weekly_distance_goal} />
              <span>km</span>
            </span>
          </label>
          <label className="field">
            <span className="field-label">Usual ride</span>
            <span className="input-with-unit">
              <input name="preferred_distance" type="number" inputMode="numeric" min="5" max="300" defaultValue={user.preferred_distance} />
              <span>km</span>
            </span>
          </label>
        </div>
      </section>

      <div className="save-bar" hidden={!dirty && !saving} role="region" aria-label="Unsaved changes">
        <p>You have unsaved changes.</p>
        <div className="button-row">
          <button
            type="button"
            className="button button-ghost button-small"
            disabled={saving}
            onClick={() => {
              form.current?.reset();
              setDirty(false);
            }}
          >
            Discard
          </button>
          <button className="button button-primary button-small" disabled={saving} aria-busy={saving}>
            {saving && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
