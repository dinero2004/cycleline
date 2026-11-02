"use client";

import { AlertCircle, ArrowUp, Eye, EyeOff, Info } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { passwordStrength } from "@/lib/forms";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id">;

export interface FieldProps extends InputProps {
  label: string;
  name: string;
  /** Leading icon, drawn in the fixed 48px slot. */
  icon?: ReactNode;
  /** Quiet helper text under the control. */
  hint?: ReactNode;
  /** Error from the server; replaces the hint and wins over the blur check. */
  error?: string;
  /** Runs on blur (and on change once the field has shown an error). */
  validate?: (value: string) => string | null;
  /** Trailing control in the right-hand 48px slot (password toggle). */
  action?: ReactNode;
  /** Extra message under the control, such as the caps-lock warning. */
  extra?: ReactNode;
}

/** Label above, control, then helper or error text: one left edge, linked with aria-describedby. */
export function Field({ label, name, icon, hint, error, validate, action, extra, onBlur, onChange, ...input }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const [checked, setChecked] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const message = error ?? checked;

  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className={`field-control${icon ? " has-icon" : ""}${action ? " has-action" : ""}`}>
        {icon && (
          <span className="field-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          id={id}
          name={name}
          aria-invalid={message ? true : undefined}
          aria-describedby={message || hint ? messageId : undefined}
          onBlur={(event) => {
            setTouched(true);
            if (validate) setChecked(validate(event.currentTarget.value));
            onBlur?.(event);
          }}
          onChange={(event) => {
            if (validate && touched) setChecked(validate(event.currentTarget.value));
            onChange?.(event);
          }}
          {...input}
        />
        {action}
      </div>
      {/* Always rendered so screen readers hear new messages. */}
      <div aria-live="polite" className="field-live">
        {message ? (
          <p id={messageId} className="field-message is-error">
            <AlertCircle size={14} aria-hidden="true" />
            {message}
          </p>
        ) : hint ? (
          <p id={messageId} className="field-message">
            {hint}
          </p>
        ) : null}
        {extra}
      </div>
    </div>
  );
}

/** Password with a show/hide toggle, caps-lock warning and, for new passwords, a strength hint. */
export function PasswordField({ showStrength = false, hint, ...props }: Omit<FieldProps, "type" | "action"> & { showStrength?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [value, setValue] = useState("");
  const strength = passwordStrength(value);
  const detectCaps = (event: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState?.("CapsLock") ?? false);

  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onKeyDown={detectCaps}
      onKeyUp={detectCaps}
      onChange={(event) => {
        setValue(event.currentTarget.value);
        props.onChange?.(event);
      }}
      hint={showStrength && strength.score > 0 ? <>Strength: {strength.label}. {hint}</> : hint}
      action={
        <button
          type="button"
          className="field-action"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      }
      extra={
        <>
          {showStrength && (
            <div className="strength" data-score={strength.score} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
          {capsLock && (
            <p className="field-message is-warning">
              <ArrowUp size={14} aria-hidden="true" />
              Caps Lock is on.
            </p>
          )}
        </>
      }
    />
  );
}

/** Small inline note with an icon, for form-level information. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="field-message">
      <Info size={14} aria-hidden="true" />
      {children}
    </p>
  );
}
