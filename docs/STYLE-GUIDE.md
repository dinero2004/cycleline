# CycleLine style guide

Calm, confident, technical but friendly. Neutrals carry about 90% of the interface. One orange action per screen.

- **Tokens:** `frontend/src/app/styles/tokens.css`
- **Components:** `frontend/src/app/styles/components.css`, plus `components/ui/field.tsx` and `components/ui/confirm-dialog.tsx`
- **Page styles:** `auth.css`, `profile.css`, `legal.css` and `studio.css`, all next to the tokens.

## Tokens

### Type

| Token | Size / line height | Use |
|---|---|---|
| `--text-xs` | 12 / 16 | metadata, chart labels |
| `--text-sm` | 13 / 18 | labels, helper and error text |
| `--text-md` | 14 / 20 | body UI, small buttons, legal line |
| `--text-base` | 16 / 24 | inputs, buttons, reading text |
| `--text-lg` | 20 / 28 | card titles |
| `--text-xl` | 28 / 32 | page titles |
| `--text-2xl` | 40 / 44 | hero and auth visual headline |
| `--text-3xl` | 56 / 56 | largest display |

**Fonts.**
- Inter is the UI font, used for everything by default.
- Barlow Condensed (`--font-display`) is only for `h1`, `h2`, `.display` and the logo wordmark.
- The logo is the only uppercase text.

**Weights.**
- 400 (`--weight-regular`) for text.
- 500 (`--weight-medium`) for labels and links.
- 600 (`--weight-semibold`) for buttons, titles and figures.
- No other weights, no forced uppercase, no wide tracking.

### Spacing

Spacing sits on a 4px grid: `--space-1` 4, `-2` 8, `-3` 12, `-4` 16, `-5` 20, `-6` 24, `-8` 32, `-12` 48, `-16` 64.

| Distance | Value |
|---|---|
| Between fields | 20px |
| Between form groups | 32px |
| Card padding | 24px (20px under 640px) |

### Radius and elevation

**Radius.**
- `--radius-control` (8px): inputs, buttons, menus.
- `--radius-card` (12px): cards, sheets, dialogs.
- `--radius-pill` (999px): pills, avatars, toggles.
- Square corners only on full-bleed panels, such as the mobile sidebar.

**Elevation.**
- `--shadow-1` for resting cards.
- `--shadow-2` for popovers, toasts, dialogs and the save bar.
- Hairlines use `--line-soft`; inputs use `--line`.

### Colour

Both themes define the same names. `data-theme` on `<html>` wins; without it, the system theme applies.

| Token | Role |
|---|---|
| `--ink` | page background |
| `--surface` | cards, inputs (one step above the page) |
| `--surface-raised`, `--surface-soft` | hover and quiet fills |
| `--text`, `--text-2`, `--muted` | text, secondary text, helper text (all AA on `--ink` and `--surface`) |
| `--orange-50/100/500/600` | accent scale; 500 fills the primary button, 50/100 are quiet tints (avatar, active nav card), 600 is the light-theme focus ring |
| `--orange-text` | orange on light backgrounds (warnings, small markers) |
| `--lime`, `--lime-text`, `--success`, `--success-bg` | data (routes, positive metrics) and success only, never buttons or decoration |
| `--danger`, `--danger-bg` | errors and destructive actions |
| `--focus` | the 2px focus ring |

**Rules for orange.**
- Use it for the one primary action in view, the focus ring, and small state markers such as the finish pin and the strength meter.
- Never use it for a whole card.
- Secondary actions use `.button-secondary` or `.button-ghost`.

### Motion

- `--duration-fast` (150ms) and `--duration` (200ms), both with `--ease-out`.
- State changes shift background or border colour; nothing moves on hover.
- `prefers-reduced-motion` sets both durations to 0.

## Components

### Button

`.button` plus one variant:

| Variant | Use |
|---|---|
| `.button-primary` | the single orange action |
| `.button-secondary` | outlined |
| `.button-ghost` | text until hovered |
| `.button-danger` | destructive |

**Sizes.**
- Default is 48px high.
- `.button-small` is 44px high.
- `.button-full` makes it full width.
- The auth submit button is 52px high.

**States.**
- Hover: background shift.
- Focus: 2px ring.
- `disabled`: 55% opacity, not-allowed cursor.
- `aria-busy="true"`: shows a spinner and progress text ("Signing in…").

The old names `.button-acid` and `.button-dark` map to primary, and `.button-light` maps to secondary.

### Field (`components/ui/field.tsx`)

`<Field label name icon? hint? error? validate? action? />` renders:
- the label above the input,
- the control,
- a live message area underneath.

**Layout.**
- The control is 48px high with 16px text, 16px horizontal padding and an 8px radius.
- A leading icon sits in a fixed 48px slot, with the text starting at 44px.
- A trailing action (such as the password toggle) sits in a 44px button at the right.
- Labels are 13px at weight 500, with an 8px gap above the control.
- Helper and error text sits 6px below the control, at 13px with an icon. Errors are never shown by colour alone.
- Messages are linked with `aria-describedby` and announced through `aria-live="polite"`.

**States.**
- default, hover (darker border), focus (2px `--focus` ring with 2px offset), filled
- error (`aria-invalid`, danger border and message)
- disabled
- checked on blur, then live once an error has shown

**Password field.** `<PasswordField showStrength? />` adds:
- the show/hide toggle,
- a caps-lock warning,
- a four-step strength hint (`lib/forms.ts`).

**Attributes.** Always set `autoComplete` (`username`, `current-password`, `new-password`, `email`), `inputMode`, `enterKeyHint`, and `autoCapitalize="off"` on names and emails.

**Plain controls.** Plain `<input>`, `<select>` and `<textarea>` get the same base look through a zero-specificity `:where()` rule. Inside `.stack-form`, a `<label>` wrapping text and a control stacks them without a box.

### Tabs

`.tabs` holds `role="tab"` buttons with an underline on the selected one. Arrow keys move between tabs. Used on the sign-in screen.

### Card

`.card` has 24px padding, a 12px radius, a soft border and `--shadow-1`.
- Header: `.card-header` with `.card-title` and `.card-description`, and an optional action on the right.
- Destructive sections use `.card.is-danger`.

### Dialog (`components/ui/confirm-dialog.tsx`)

A native `<dialog>` opened with `showModal()`:
- Escape or a click on the backdrop closes it, and focus returns to the button that opened it.
- On narrow screens the buttons stack, with the action at the bottom.
- Every destructive action goes through it: remove bike, delete account.

### Toast

Uses sonner, top right, in theme colours (set on `<Toaster>` in `layout.tsx`). It confirms saves and reports errors that don't belong to one field. The success icon uses `--success` and the error icon uses `--danger`.

### Pill

`.pill` is a neutral 28px status chip. `.pill.is-accent` uses the quiet orange tint.

### Save bar

`.save-bar` is a sticky bar above the bottom safe area. It appears only when a form differs from what was loaded, offering Discard and Save changes.

## Checklist for new screens

1. Has one orange button at most.
2. Fields and buttons are 48px tall and inputs are 16px or larger (iOS doesn't zoom).
3. Tap targets are at least 44px.
4. Every input has a visible label; errors have an icon and text.
5. Spacing and sizes come from tokens; no raw pixel sizes outside the scale.
6. Checked at 320, 390, 768 and 1440px, in light and dark, with no horizontal scroll.
