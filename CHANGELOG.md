# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-04-13

Fills the v0.1.0 coverage gap against the agent-tasks API so users don't
have to reach for `curl`. Every endpoint the backend exposes is now a CLI
command.

### Added

- `tasks create <project-slug-or-id>` — wraps `POST /api/projects/:id/tasks`.
  Accepts slug or UUID; supports `--title` (required), `--description`,
  `--priority`, `--workflow`, `--due-at`, `--external-ref`, and repeatable
  `--label`. Priority is validated before the slug resolve so typos fail fast.
- `tasks get <task-id>` — `GET /api/tasks/:id` without the instructions overhead.
- `tasks release <task-id>` — releases a claimed task back to the pool.
- `projects list` — list projects visible to the current token.
- `projects get <slug-or-id>` — fetch a single project by slug or UUID.
- `github pr create` — delegate PR creation via the backend
  (`POST /api/github/pull-requests`). A team member with `allowAgentPrCreate`
  consent acts on the agent's behalf.
- `github pr merge <pr-number>` — delegate merge via the backend with
  `--method merge|squash|rebase` (default: `squash`).
- `github pr comment <pr-number> <body>` — delegate PR comment via the backend.

### Security

- Bumped `vitest` devDep `^2.1.0` → `^3.2.4` to clear two medium Dependabot
  alerts in the transitive chain: GHSA-4w7w-66w2-5vf9 (vite `.map` path
  traversal) and GHSA-67mh-4wv8-2f99 (esbuild dev-server CORS). Dev-only, no
  runtime impact.

## [0.1.0] - 2026-04-13

Initial public release of agent-tasks-cli — a standalone CLI client for
local AI agents.

### Added

- `tasks list` — list tasks with optional status and project filters
- `tasks claim <task-id>` — claim a task for the current agent
- `tasks status <task-id> <state>` — transition a task to a new workflow state
  (valid states: `open`, `in_progress`, `review`, `done`)
- `tasks update <task-id>` — update `--branch`, `--pr-url`, `--pr-number`, etc.
- `tasks comment <task-id> <message>` — post a comment on a task
- `tasks instructions <task-id>` — fetch the authoritative agent instructions
  (state, allowed transitions, required fields, confidence score)
- `review approve <task-id>` — approve a task with optional `-c <comment>`
- `review request-changes <task-id>` — request changes on a task
- `review claim <task-id>` — acquire the single-reviewer lock
- `review release <task-id>` — release the review lock
- `signals` — poll the signal inbox for pending signals
- `signals ack <signal-id>` — acknowledge a signal
- Configuration via env vars (`AGENT_TASKS_ENDPOINT`, `AGENT_TASKS_TOKEN`) or
  `~/.agent-tasks.json` / `~/.config/agent-tasks/config.json`
- `--json` and `--quiet` output modes across list commands
- Colored terminal output with status formatting
- CI pipeline (GitHub Actions): typecheck, build, test
