/** Client-side checks for the account forms. They mirror the Laravel rules, which stay the source of truth. */

export function validateLogin(value: string): string | null {
  return value.trim() ? null : "Enter your username or email.";
}

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? null : "That email address looks incomplete.";
}

/** Laravel: min:3, max:40, alpha_dash. */
export function validateUsername(value: string): string | null {
  const name = value.trim();
  if (name.length < 3) return "Use at least 3 characters.";
  if (name.length > 40) return "Use 40 characters or fewer.";
  return /^[\p{L}\p{N}_-]+$/u.test(name) ? null : "Use letters, numbers, - and _ only.";
}

/** Laravel: min:6. */
export function validatePassword(value: string): string | null {
  if (!value) return "Enter a password.";
  return value.length < 6 ? "Use at least 6 characters." : null;
}

export interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const LABELS = ["", "Too short", "Okay", "Good", "Strong"];

/** A rough hint, not a gate: length counts most, then mixing letter case, digits and symbols. */
export function passwordStrength(value: string): Strength {
  if (!value) return { score: 0, label: "" };
  if (value.length < 6) return { score: 1, label: LABELS[1] };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((kind) => kind.test(value)).length;
  let score: Strength["score"] = 2;
  if (value.length >= 10 && kinds >= 3) score = 3;
  if (value.length >= 16 && kinds >= 3) score = 4;
  return { score, label: LABELS[score] };
}
