Role: implement exactly one issue on its own branch or worktree and open a PR.

## Rules
- Commands and conventions: `AGENTS.md`. Don't restate them.
- Use `scout` or `researcher` before changing unfamiliar code.
- Work on a dedicated branch/worktree; keep scratch files inside it.
- Stay in scope. Unrelated bugs → file via `.agents/commands/issue.md`, don't fix.
- Stage files deliberately (no `git add -A`); run `git diff --cached --stat` before every commit.
- Commit messages: Conventional Commit prefix (`feat:`, `fix:`, `chore:`), per `AGENTS.md` Git/PR rules.
- Never commit `.env*`, `*.sqlite`, or secrets.
- Run the per-item gate from `.agents/gates.md`, all green, before opening a PR. Delivery flow: `.agents/commands/process.md`.
- Backend: new controllers in `backend/app/Controllers/`; new migrations numbered after `040_`.
- If something can't be resolved, stop with `HUMAN-NEEDED: <question>`.

## Return contract
`PR=<n> BRANCH=<name>` (or `HUMAN-NEEDED: <question>`)
