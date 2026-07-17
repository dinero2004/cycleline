"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { toast } from "sonner";
import { registerAction, type ActionState } from "@/app/actions";

const initialState: ActionState = { ok: false, message: "" };

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [state, registerFormAction, isRegistering] = useActionState(registerAction, initialState);

  useEffect(() => {
    if (state.message) {
      if (state.ok) {
        toast.success(state.message);
      } else {
        toast.error(state.message);
      }
    }
  }, [state]);

  async function handleLogin(formData: FormData) {
    setIsLoggingIn(true);
    setLoginError("");

    const result = await signIn("credentials", {
      login: formData.get("login"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setLoginError("We could not match those details. Check them and try again.");
      setIsLoggingIn(false);
      return;
    }

    const session = await getSession();
    router.push(session?.user?.isAdmin ? "/admin" : "/dashboard");
    router.refresh();
  }

  const fieldError = (name: string) => state.errors?.[name]?.[0];

  return (
    <div className="auth-panel">
      <div className="auth-tabs" role="tablist" aria-label="Account action">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? "active" : undefined}
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={mode === "register" ? "active" : undefined}
          onClick={() => setMode("register")}
        >
          Create account
        </button>
      </div>

      <div className="auth-heading">
        <span className="auth-icon">
          {mode === "login" ? <LockKeyhole size={22} /> : <UserRound size={22} />}
        </span>
        <div>
          <h1>{mode === "login" ? "Welcome back, rider." : "Make CycleLine yours."}</h1>
          <p>
            {mode === "login"
              ? "Sign in to plan, save, and revisit your routes."
              : "Create a profile for your routes, fitness, and bikes."}
          </p>
        </div>
      </div>

      {mode === "login" ? (
        <form action={handleLogin} className="auth-form">
          <label>
            Username or email
            <span className="input-wrap">
              <Mail size={17} />
              <input name="login" autoComplete="username" placeholder="alexrider" required />
            </span>
          </label>
          <label>
            Password
            <span className="input-wrap">
              <LockKeyhole size={17} />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          <div className="auth-options">
            <label className="check-label">
              <input type="checkbox" name="remember" defaultChecked />
              <span>Keep me signed in</span>
            </label>
            <button type="button" className="link-button" onClick={() => toast.info("Ask a CycleLine administrator to reset your password.")}>
              Forgot password?
            </button>
          </div>
          {loginError && <p className="form-error">{loginError}</p>}
          <button className="button button-acid button-full" disabled={isLoggingIn}>
            {isLoggingIn && <LoaderCircle className="spin" size={17} />}
            Sign in to CycleLine
          </button>
          <p className="demo-hint">
            Demo rider: <code>alexrider</code> · <code>CycleLine!2026</code>
          </p>
        </form>
      ) : state.ok ? (
        <div className="auth-success">
          <CheckCircle2 size={32} />
          <h2>Account ready.</h2>
          <p>{state.message}</p>
          <button type="button" className="button button-acid button-full" onClick={() => setMode("login")}>
            Continue to sign in
          </button>
        </div>
      ) : (
        <form action={registerFormAction} className="auth-form">
          <label>
            Email
            <span className="input-wrap">
              <Mail size={17} />
              <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            </span>
            {fieldError("email") && <small className="form-error">{fieldError("email")}</small>}
          </label>
          <label>
            Username
            <span className="input-wrap">
              <UserRound size={17} />
              <input name="username" autoComplete="username" placeholder="yourname" required minLength={3} />
            </span>
            {fieldError("username") && <small className="form-error">{fieldError("username")}</small>}
          </label>
          <label>
            Password
            <span className="input-wrap">
              <LockKeyhole size={17} />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="6 or more characters"
                required
                minLength={6}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
            <small className="field-hint">Use at least 6 characters. No symbol or number is required.</small>
            {fieldError("password") && <small className="form-error">{fieldError("password")}</small>}
          </label>
          <label>
            Repeat password
            <span className="input-wrap">
              <LockKeyhole size={17} />
              <input
                name="password_confirmation"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat your password"
                required
                minLength={6}
              />
            </span>
            {fieldError("password_confirmation") && (
              <small className="form-error">{fieldError("password_confirmation")}</small>
            )}
          </label>
          <button className="button button-acid button-full" disabled={isRegistering}>
            {isRegistering && <LoaderCircle className="spin" size={17} />}
            Create my account
          </button>
        </form>
      )}
    </div>
  );
}
