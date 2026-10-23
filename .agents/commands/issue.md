# Issue procedure

Input: a seed brief.

1. **Research.** Find the implicated code; quote the load-bearing lines with `path:line`. Layout and gotchas: `AGENTS.md`.
2. **Duplicate check.** `gh issue list --state open --limit 300 --json number,title`. On a match, return `DUPLICATE <n> <title>` and stop.
3. **Write** in this format (the repo has no prior issues to copy, so this is the default):
   - Title: `<area>: <imperative one-liner>` (areas: `backend`, `frontend`, `docker`, `docs`)
   - **Today's behavior** (quoted code + `path:line`)
   - **The gap** (2–4 bullets)
   - **Proposed** (a suggestion, not a decree)
   - **Tradeoffs**
   - **Implementation sketch** (`path:line` entry points)
   - **Footprint** (files/dirs touched)
   - **Out of scope**
   - **Refs**
4. **Labels.** Only from the existing set: `gh label list`.
5. **File.** `gh issue create --title ... --body-file ...`. If `gh` is unavailable (it was not installed when this was written), write `docs/issues/<slug>.md` in the same format instead.

Output: `Filed #<n> — <title> → <url>` plus one sentence (or the `docs/issues/` path). Never start implementation.
