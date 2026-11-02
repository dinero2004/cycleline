"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, LoaderCircle, Mail, Map as MapIcon, UserRound } from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { toast } from "sonner";
import { importGuestDraftsAction, registerAction, type ActionState } from "@/app/actions";
import { Field, Note, PasswordField } from "@/components/ui/field";
import { validateEmail, validateLogin, validatePassword, validateUsername } from "@/lib/forms";
import { importableDrafts, removeDrafts } from "@/lib/guest-drafts";

type Mode = "login" | "register";
const initialState: ActionState = { ok: false, message: "" };

export function AuthPanel({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showReset, setShowReset] = useState(false);
  // The success card shows until the rider switches tabs (which dismisses that result).
  const [dismissed, setDismissed] = useState<ActionState | null>(null);
  const [password, setPassword] = useState("");
  const [state, registerFormAction, isRegistering] = useActionState(registerAction, initialState);
  const loginTab = useRef<HTMLButtonElement>(null);
  const registerTab = useRef<HTMLButtonElement>(null);

  const registered = state.ok && dismissed !== state ? state.message : null;

  useEffect(() => {
    if (!state.ok && state.message && !state.errors) toast.error(state.message);
  }, [state]);

  function switchTo(next: Mode) {
    setMode(next);
    setLoginError("");
    setDismissed(state);
    window.history.replaceState(null, "", next === "register" ? "/login?mode=register" : "/login");
  }

  async function handleLogin(formData: FormData) {
    setIsLoggingIn(true);
    setLoginError("");

    const result = await signIn("credentials", {
      login: formData.get("login"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setLoginError("That username, email or password doesn't match an account. Check them and try again.");
      setIsLoggingIn(false);
      return;
    }

    // Guest demo drafts on this device move into the account; failed ones stay in the demo.
    const drafts = importableDrafts();
    if (drafts.length) {
      const imported = await importGuestDraftsAction(
        drafts.map((d) => ({ id: d.id, name: d.name, profile: d.profile, preferences: d.preferences ?? {}, waypoints: d.waypoints })),
      );
      removeDrafts(imported.imported);
      if (imported.ok) toast.success(imported.message);
      else toast.error(imported.message);
    }

    const session = await getSession();
    router.push(session?.user?.isAdmin ? "/admin" : drafts.length ? "/routes" : "/dashboard");
    router.refresh();
  }

  const fieldError = (name: string) => (state.ok ? undefined : state.errors?.[name]?.[0]);
  const tabRef = { login: loginTab, register: registerTab };

  return (
    <div className="auth-panel">
      <div className="tabs" role="tablist" aria-label="Account">
        {(["login", "register"] as const).map((tab) => (
          <button
            key={tab}
            ref={tabRef[tab]}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            aria-selected={mode === tab}
            aria-controls="auth-tabpanel"
            tabIndex={mode === tab ? 0 : -1}
            onClick={() => switchTo(tab)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              const other = tab === "login" ? "register" : "login";
              switchTo(other);
              tabRef[other].current?.focus();
            }}
          >
            {tab === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <div id="auth-tabpanel" role="tabpanel" aria-labelledby={`tab-${mode}`}>
        <header className="auth-heading">
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p>
            {mode === "login"
              ? "Sign in to plan, save and ride your routes again."
              : "Free, and it keeps your routes, bikes and fitness in one place."}
          </p>
        </header>

        {mode === "login" ? (
          <form action={handleLogin} className="auth-form">
            <Field
              label="Username or email"
              name="login"
              icon={<Mail size={18} />}
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              enterKeyHint="next"
              placeholder="you@example.com"
              validate={validateLogin}
              required
            />
            <PasswordField
              label="Password"
              name="password"
              autoComplete="current-password"
              enterKeyHint="go"
              placeholder="Your password"
              validate={(value) => (value ? null : "Enter your password.")}
              required
            />
            {loginError && (
              <p className="form-alert" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {loginError}
              </p>
            )}
            <button className="button button-primary button-full auth-submit" disabled={isLoggingIn} aria-busy={isLoggingIn}>
              {isLoggingIn && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
              {isLoggingIn ? "Signing in…" : "Sign in"}
            </button>
            <div className="auth-help" aria-live="polite">
              <button type="button" className="link-button" aria-expanded={showReset} onClick={() => setShowReset((open) => !open)}>
                Forgot your password?
              </button>
              {showReset && <Note>Password resets go through a CycleLine administrator for now. Ask them to set a new one for you.</Note>}
            </div>
          </form>
        ) : registered ? (
          <div className="auth-success" role="status">
            <CheckCircle2 size={28} aria-hidden="true" />
            <h2>Your account is ready</h2>
            <p>{registered}</p>
            <button type="button" className="button button-primary button-full" onClick={() => switchTo("login")}>
              Continue to sign in
            </button>
          </div>
        ) : (
          <form action={registerFormAction} className="auth-form">
            <Field
              label="Email"
              name="email"
              type="email"
              icon={<Mail size={18} />}
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="email"
              enterKeyHint="next"
              placeholder="you@example.com"
              validate={validateEmail}
              error={fieldError("email")}
              required
            />
            <Field
              label="Username"
              name="username"
              icon={<UserRound size={18} />}
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="yourname"
              hint="Shown on your routes. Letters, numbers, - and _."
              validate={validateUsername}
              error={fieldError("username")}
              required
              minLength={3}
              maxLength={40}
            />
            <PasswordField
              label="Password"
              name="password"
              autoComplete="new-password"
              enterKeyHint="next"
              placeholder="6 or more characters"
              hint="Longer is stronger; no symbols required."
              showStrength
              validate={validatePassword}
              error={fieldError("password")}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              minLength={6}
            />
            <PasswordField
              label="Repeat password"
              name="password_confirmation"
              autoComplete="new-password"
              enterKeyHint="go"
              placeholder="Same password again"
              validate={(value) => (!value ? "Repeat your password." : value !== password ? "The two passwords don't match." : null)}
              error={fieldError("password_confirmation")}
              required
              minLength={6}
            />
            <button className="button button-primary button-full auth-submit" disabled={isRegistering} aria-busy={isRegistering}>
              {isRegistering && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
              {isRegistering ? "Creating your account…" : "Create account"}
            </button>
          </form>
        )}

        <div className="auth-divider" role="separator">
          <span>or</span>
        </div>
        <Link href="/demo" className="button button-secondary button-full">
          <MapIcon size={18} aria-hidden="true" /> Try the planner without an account
        </Link>
        <p className="auth-switch">
          {mode === "login" ? "New to CycleLine?" : "Already have an account?"}{" "}
          <button type="button" className="link-button" onClick={() => switchTo(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
