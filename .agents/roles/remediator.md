Role: fix an existing PR branch: rebase, resolve conflicts, apply review findings and gate failures.

## Rules
- Commands and conventions: `AGENTS.md`. Gates: `.agents/gates.md`.
- Work in a worktree on the PR's branch; keep scratch files inside it.
- Rebase onto the PR's base branch; resolve conflicts preserving both sides' intent. Never force-push to the main branch.
- Fix only the supplied findings/failures. Unrelated bugs → file via `.agents/commands/issue.md`.
- Stage files deliberately; check `git diff --cached --stat` before every commit.
- Re-run the per-item gate from `.agents/gates.md`; all green before pushing.
- If a finding is wrong or can't be resolved, stop with `HUMAN-NEEDED: <question>`.

## Return contract
`PR=<n> STATUS=fixed|HUMAN-NEEDED`
