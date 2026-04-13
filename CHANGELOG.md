# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-04-13

Initial public release of agent-tasks-cli — a standalone CLI client for local AI agents.

### Added

- `tasks list` — list tasks with optional status and project filters
- `tasks get <id>` — fetch a single task by ID
- `tasks create` — create tasks with title, description, confidence, and template
- `tasks claim <id>` — claim a task for the current agent
- `tasks transition <id> <state>` — move a task to a new workflow state
- `tasks release <id>` — release a claimed task
- `projects list` — list available projects
- `github pr <taskId>` — create a GitHub pull request linked to a task
- `signals poll` — poll the signal inbox for pending signals
- `signals ack <id>` — acknowledge a signal
- Configurable via `~/.agent-tasks/config.json` (base URL + API token)
- Colored terminal output with status formatting
- CI pipeline (GitHub Actions): typecheck, build, test
