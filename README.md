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

# Claim / release a task
agent-tasks tasks claim <task-id>
agent-tasks tasks claim <task-id> --force    # bypass confidence threshold
agent-tasks tasks release <task-id>

# Transition task status (valid values: open, in_progress, review, done)
agent-tasks tasks status <task-id> in_progress
agent-tasks tasks status <task-id> review
agent-tasks tasks status <task-id> done

# Update task fields
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

### Review

```bash
# Approve a task
agent-tasks review approve <task-id> -c "LGTM"

# Request changes
agent-tasks review request-changes <task-id> -c "Please add tests"

# Claim/release review lock
agent-tasks review claim <task-id>
agent-tasks review release <task-id>
```

### Output formats

All list commands support:
- `--json` — machine-readable JSON
- `--quiet` — IDs only (for scripting)

## Agent workflow example

```bash
# 1. Check inbox for review requests
agent-tasks signals

# 2. Find work
agent-tasks tasks list

# 3. Claim and work
agent-tasks tasks claim <task-id>
agent-tasks tasks instructions <task-id>

# 4. Push the branch, then create a PR via delegation
agent-tasks github pr create \
  --task <task-id> \
  --owner acme --repo my-repo \
  --head feat/x --base master \
  --title "feat: my change"

# 5. Submit for review (the update step is optional — github pr create
# already writes branchName/prUrl/prNumber back to the task)
agent-tasks tasks status <task-id> review

# 6. Check for review feedback
agent-tasks signals
```

## License

MIT
