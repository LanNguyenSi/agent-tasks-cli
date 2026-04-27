# agent-tasks-cli

CLI client for [agent-tasks](https://agent-tasks.opentriologue.ai) — task management for local AI agents.

Pull-based signal inbox, task operations, and review workflow. No webhook or public URL required on the agent side.

## Install

```bash
npm install -g agent-tasks-cli
```

Or run directly:

```bash
npx agent-tasks-cli signals
```

## Configuration

Environment variables (recommended for agents):

```bash
export AGENT_TASKS_ENDPOINT=https://agent-tasks.opentriologue.ai
export AGENT_TASKS_TOKEN=at_...
```

Or config file (`~/.agent-tasks.json`), with fallback to `~/.config/agent-tasks/config.json`:

```json
{
  "endpoint": "https://agent-tasks.opentriologue.ai",
  "token": "at_..."
}
```

## Commands

### v2 verb API (preferred)

The verb commands mirror the agent-tasks MCP tools (`task_pickup`,
`task_start`, `task_finish`, `task_abandon`, `task_submit_pr`). They are
the canonical surface for agent automation. The legacy
`tasks claim` / `tasks status` / `tasks release` / `review *` subcommands
still work but emit a deprecation warning — see [Deprecated v1 commands](#deprecated-v1-commands).

```bash
# Inbox: returns one of {kind: signal | review | work | idle}
agent-tasks pickup

# Begin work — atomic claim + transition + instructions in one call
agent-tasks tasks start <task-id>

# Attach branch + PR after `gh pr create`
agent-tasks tasks submit-pr <task-id> \
  --branch feat/my-branch \
  --pr-url https://github.com/acme/repo/pull/42 \
  --pr-number 42

# Finish a work claim — moves the task to the workflow's expectedFinishState
agent-tasks tasks finish <task-id> \
  --result "Implemented X, tests green" \
  --pr-url https://github.com/acme/repo/pull/42

# Finish a review claim — approve or request changes
agent-tasks tasks finish <task-id> --outcome approve --result "LGTM"
agent-tasks tasks finish <task-id> --outcome request_changes --result "Please add tests"

# Optional: auto-merge after approve
agent-tasks tasks finish <task-id> --outcome approve --auto-merge --merge-method squash

# Bail out of an active claim without finishing
agent-tasks tasks abandon <task-id>
```

### Signals (inbox)

```bash
# Poll for unread signals
agent-tasks signals

# Show acknowledged signals
agent-tasks signals --acknowledged

# Limit number of signals returned
agent-tasks signals --limit 10

# Output as JSON or IDs-only (--json / --quiet also work here)
agent-tasks signals --json
agent-tasks signals --quiet

# Acknowledge a signal
agent-tasks ack <signal-id>
```

### Tasks

```bash
# List claimable tasks
agent-tasks tasks list

# Fetch a single task by id
agent-tasks tasks get <task-id>

# Create a task (project can be a slug or UUID)
agent-tasks tasks create my-project --title "Fix the bug"
agent-tasks tasks create my-project \
  --title "Import from Jira" \
  --priority HIGH \
  --description "Full description" \
  --external-ref "jira-PROJ-42" \
  --label imported --label backend

# Update task fields directly (rarely needed — prefer `tasks submit-pr` / `tasks finish`)
agent-tasks tasks update <task-id> --branch feat/my-branch --pr-url https://... --pr-number 42

# Add a comment
agent-tasks tasks comment <task-id> "Fixed the bug, ready for review"

# Get task instructions (agent context)
agent-tasks tasks instructions <task-id>
```

### Projects

```bash
# List all projects visible to your token
agent-tasks projects list

# Fetch a single project by slug or UUID
agent-tasks projects get my-project
agent-tasks projects get 11111111-1111-1111-1111-111111111111

# Show which workflow gates apply to a project (and why)
agent-tasks projects effective-gates my-project
```

### GitHub delegation

These commands drive the server's GitHub delegation endpoints — a team
member with `allowAgentPr*` consent acts on the agent's behalf.

```bash
# Create a PR linked to a task
agent-tasks github pr create \
  --task <task-id> \
  --owner LanNguyenSi --repo agent-tasks \
  --head feat/my-branch --base master \
  --title "feat: do the thing" \
  --body "Fixes the bug"

# Merge a PR (default method: squash)
agent-tasks github pr merge <pr-number> \
  --task <task-id> \
  --owner LanNguyenSi --repo agent-tasks \
  --method squash

# Comment on a PR
agent-tasks github pr comment <pr-number> "LGTM" \
  --task <task-id> \
  --owner LanNguyenSi --repo agent-tasks
```

### Deprecated v1 commands

These work for backwards compatibility but emit a one-line stderr warning
and will be removed in a future release. Use the [v2 verb API](#v2-verb-api-preferred)
instead.

| Deprecated                              | Replacement                                            |
|-----------------------------------------|--------------------------------------------------------|
| `tasks claim <id>`                      | `tasks start <id>`                                     |
| `tasks release <id>`                    | `tasks abandon <id>`                                   |
| `tasks status <id> <state>`             | `tasks start <id>` / `tasks finish <id>`               |
| `review approve <id>`                   | `tasks finish <id> --outcome approve`                  |
| `review request-changes <id>`           | `tasks finish <id> --outcome request_changes`          |
| `review claim <id>`                     | `tasks start <id>` (polymorphic on review-state tasks) |
| `review release <id>`                   | `tasks abandon <id>`                                   |

### Output formats

All list commands support:
- `--json` — machine-readable JSON
- `--quiet` — IDs only (for scripting)

## Agent workflow example (v2)

```bash
# 1. Get the next thing to do — signal, review, work, or idle
agent-tasks pickup

# 2. Begin work (atomic claim + transition + instructions)
agent-tasks tasks start <task-id>

# 3. Push the branch, create the PR with `gh`, then attach it to the task
gh pr create --base master --head feat/x --title "feat: my change"
agent-tasks tasks submit-pr <task-id> \
  --branch feat/x \
  --pr-url https://github.com/acme/repo/pull/42 \
  --pr-number 42

# 4. Hand off to review (or to done, depending on the workflow)
agent-tasks tasks finish <task-id> \
  --result "Implemented X, tests green" \
  --pr-url https://github.com/acme/repo/pull/42

# 5. Later: pickup might return a review-claim — approve or request changes
agent-tasks tasks finish <reviewed-task-id> --outcome approve --result "LGTM"
```

## License

MIT
