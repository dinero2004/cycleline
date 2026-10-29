# CycleLine backlog

## Priority 1+ßuÁ‚ùÁT production and gate health

### Restore a repeatable host-side gate environment
Goal: Make the documented backend and frontend quality gates runnable from the CycleLine checkout without relying on unavailable host executables.
Acceptance criteria:
- The documented gate commands can be invoked in the approved development environment.
- No production secrets or runtime configuration are exposed or changed.
- The maintenance log records the verified approach.

## Priority 2 ∫w^~)ﬁt verified product bugs

### Treat blank optional fitness values as unset
Goal: Let riders clear optional height and weight fields without converting blanks to invalid zero values.
Acceptance criteria:
- Blank optional values are omitted or represented as null consistently.
- Existing valid profile updates remain unchanged.
- The change is covered by appropriate validation or action-level checks.

## Priority 3"È›y¯ßy‘ responsive, accessibility, and performance

### Audit planner controls at narrow viewport widths
Goal: Ensure planner controls remain reachable and legible on a 320px-wide viewport.
Acceptance criteria:
- Controls do not overlap or cause unintended horizontal scrolling.
- Keyboard focus is visible and logical.
- The relevant frontend checks pass.

## Priority 4"È›y¯ßy‘ coverage for existing behavior

### Cover bike default selection and owner scoping
Goal: Protect bike default-promotion rules and prevent cross-account updates or deletes.
Acceptance criteria:
- Feature tests cover first-bike defaulting and switching defaults.
- Feature tests cover default promotion after deletion.
- Feature tests verify another rider receives 404 for update and delete.

## Priority 5 ∫w^~)ﬁt small product features

### Route library filters
Goal: Help riders find saved routes by distance and surface.
Acceptance criteria:
- Filters are owner-scoped and work with existing saved routes.
- Empty states and reset behavior are clear on mobile.
- Backend and frontend validation cover the filter inputs.
