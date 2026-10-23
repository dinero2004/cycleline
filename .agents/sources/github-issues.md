# Source: GitHub issues (dinero2004/cycleline)

Reads via GitHub MCP server (read-only); writes via `gh` (must be authenticated: `gh auth status`).

## Select
- List: `github-mcp-server-list_issues` owner=`dinero2004` repo=`cycleline` state=`OPEN` labels=`["agent-ready"]` (verified: returns 0 items today).
- Skip any item that also has label `needs-human`, `blocked` or `needs-design`.
- Read one: `github-mcp-server-issue_read` method=`get` (and `get_comments`).

## Claim
`gh issue edit <n> --add-label in-progress`

## Write-back
- Done: `gh issue comment <n> --body "PR: <url>"`, then `gh issue edit <n> --add-label in-review --remove-label agent-ready --remove-label in-progress`. The issue closes via the integration PR (`Closes #<n>` in its body).
- Skipped / human-needed: `gh issue comment <n> --body "<reason>"`, `gh issue edit <n> --add-label needs-human` (or `blocked`).
- Missing labels: create with `gh label create <name>` only for `agent-ready`, `in-progress`, `in-review`, `needs-human`, `blocked`, `needs-design`.

## Close
Merging the integration PR closes the issue; never `gh issue close` directly.

## Notes
- The repo has no existing labels or issues to copy; this label set is the agreed default.
- PR/merge operations use `gh pr create|diff|merge` (see `.agents/commands/process.md`).
