# Process loop

Start only when the user invokes it. Never start after an issue is filed. The main session only orchestrates; reading code, writing code and running tests go to roles (`.agents/roles/`).

Config: source `.agents/sources/github-issues.md`; gates `.agents/gates.md`; max **3** coders at once; max **2** review/fix rounds per item; max **10** items per run.

Delivery: per-item PRs into a batch branch `batch/<yyyymmdd-hhmm>` (created from the default branch); one integration PR to the default branch after the final gate is green.

## Steps
1. **Fetch.** List in-scope items per the source file (≤10). Skip items with `needs-human`, `blocked` or `needs-design`.
2. **Triage.** Per item: actionable, needs human input, or blocked by another item. Use `researcher` when a code read is needed to decide. Write back the reason for every non-actionable item (source file → Write-back).
3. **Plan units.** Group items by the "Footprint" section in the issue body. Overlapping footprints go to one coder or run sequentially, never in parallel. Order dependent units.
4. **Implement.** Per unit, send a `coder` (own worktree, branched from the batch branch, PR base = batch branch) the item text verbatim. Claim the item first. ≤3 coders at once.
5. **Review.** Read each PR diff yourself (`gh pr diff <n>`, never the coder's summary), then send to `reviewer`. If `changes-requested`, send findings to `remediator`; repeat up to 2 rounds, then mark the item human-needed.
6. **Land.** Merge approved PRs into the batch branch in dependency order (`gh pr merge <n> --squash`).
7. **Final gate.** `test-runner` runs the final gate from `.agents/gates.md` on the batch branch. On red, send the failure to `remediator`, then re-run. Open the integration PR (`gh pr create --base <default> --head batch/...`, body lists `Closes #<n>` per item) only when green; never merge to the default branch while red.
8. **Write back and report.** Update each item per the source file. Report in ≤20 lines: items done with PR links, items human-needed/blocked with reasons, gate results.

## Rules
- Bugs found along the way go to `issue-filer`; never widen a unit's scope.
- A unit that can't proceed returns `HUMAN-NEEDED` and is reported. Never guess.
- Never trust a role's summary of a diff or test result; verify via `gh pr diff` and the `test-runner` output.
- Never commit secrets or `.env*`.
