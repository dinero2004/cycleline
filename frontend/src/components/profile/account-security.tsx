"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { changePasswordAction, deleteAccountAction, type ActionState } from "@/app/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PasswordField } from "@/components/ui/field";
import { validatePassword } from "@/lib/forms";
import { useActionToast } from "./use-action-toast";

const initialState: ActionState = { ok: false, message: "" };

export function PasswordCard({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [state, formAction, saving] = useActionState(changePasswordAction, initialState);
  const error = (name: string) => (state.ok ? undefined : state.errors?.[name]?.[0]);
  useActionToast(state, () => setOpen(false));

  return (
    <section className="card" aria-labelledby="security-title">
      <header className="card-header">
        <div>
          <h2 id="security-title" className="card-title">
            Security
          </h2>
          <p className="card-description">Changing your password signs you out on your other devices.</p>
        </div>
        {!open && (
          <button type="button" className="button button-secondary button-small" onClick={() => setOpen(true)}>
            Change password
          </button>
        )}
      </header>
      {open && (
        <form action={formAction} className="stack-form">
          {/* Lets password managers file the new password under the right account. */}
          <input type="text" name="username" autoComplete="username" defaultValue={username} hidden readOnly />
          <PasswordField
            label="Current password"
            name="current_password"
            autoComplete="current-password"
            enterKeyHint="next"
            error={error("current_password")}
            required
          />
          <div className="two-column-fields">
            <PasswordField
              label="New password"
              name="password"
              autoComplete="new-password"
              enterKeyHint="next"
              showStrength
              validate={validatePassword}
              error={error("password")}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              minLength={6}
            />
            <PasswordField
              label="Repeat new password"
              name="password_confirmation"
              autoComplete="new-password"
              enterKeyHint="go"
              validate={(value) => (value !== password ? "The two passwords don't match." : null)}
              required
              minLength={6}
            />
          </div>
          <div className="button-row">
            <button className="button button-primary" disabled={saving} aria-busy={saving}>
              {saving && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
              {saving ? "Changing…" : "Change password"}
            </button>
            <button type="button" className="button button-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export function DangerZone({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, deleting] = useActionState(deleteAccountAction, initialState);
  const error = state.ok ? undefined : (state.errors?.password?.[0] ?? (state.message || undefined));

  return (
    <section className="card is-danger" aria-labelledby="danger-title">
      <header className="card-header">
        <div>
          <h2 id="danger-title" className="card-title">
            Delete account
          </h2>
          <p className="card-description">Removes your profile, saved routes and bikes for good. This can&apos;t be undone.</p>
        </div>
        <button type="button" className="button button-danger button-small" onClick={() => setOpen(true)}>
          Delete account
        </button>
      </header>

      <ConfirmDialog open={open} title="Delete your account?" onClose={() => setOpen(false)}>
        <p>
          Everything in <strong>{username}</strong>&apos;s account goes: routes, bikes and settings. Enter your password to confirm.
        </p>
        <form action={formAction} className="stack-form">
          <input type="text" name="username" autoComplete="username" defaultValue={username} hidden readOnly />
          <PasswordField label="Password" name="password" autoComplete="current-password" enterKeyHint="done" required />
          {error && (
            <p className="form-alert" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </p>
          )}
          <div className="button-row">
            <button type="button" className="button button-ghost" onClick={() => setOpen(false)}>
              Keep my account
            </button>
            <button className="button button-danger" disabled={deleting} aria-busy={deleting}>
              {deleting && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
              {deleting ? "Deleting…" : "Delete for good"}
            </button>
          </div>
        </form>
      </ConfirmDialog>
    </section>
  );
}
