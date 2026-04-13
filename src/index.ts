#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import * as api from "./api.js";
import {
  formatTasks,
  formatTask,
  formatSignals,
  formatProjects,
  formatProject,
  type OutputMode,
} from "./format.js";

const program = new Command();

function getMode(opts: { json?: boolean; quiet?: boolean }): OutputMode {
  if (opts.json) return "json";
  if (opts.quiet) return "quiet";
  return "table";
}

program
  .name("agent-tasks")
  .description("CLI client for agent-tasks — task management for local AI agents")
  .version("0.2.0");

// ── Signals ─────────────────────────────────────────────────────────────────

program
  .command("signals")
  .description("List signals (inbox)")
  .option("--unread", "Show unread signals (default)")
  .option("--acknowledged", "Show acknowledged signals")
  .option("--all", "Show all signals")
  .option("--limit <n>", "Max signals to return", "50")
  .option("--json", "JSON output")
  .option("--quiet", "Only signal IDs")
  .action(async (opts) => {
    const config = loadConfig();
    const status = opts.acknowledged ? "acknowledged" : opts.all ? "all" : "unread";
    const signals = await api.getSignals(config, status, Number(opts.limit));
    console.log(formatSignals(signals, getMode(opts)));
  });

program
  .command("ack <signal-id>")
  .description("Acknowledge a signal")
  .option("--json", "JSON output")
  .action(async (signalId, opts) => {
    const config = loadConfig();
    const signal = await api.ackSignal(config, signalId);
    if (opts.json) {
      console.log(JSON.stringify(signal, null, 2));
    } else {
      console.log(`Acknowledged: ${signal.id}`);
    }
  });

// ── Tasks ───────────────────────────────────────────────────────────────────

const tasks = program
  .command("tasks")
  .description("Task operations");

tasks
  .command("list")
  .description("List claimable tasks")
  .option("--json", "JSON output")
  .option("--quiet", "Only task IDs")
  .action(async (opts) => {
    const config = loadConfig();
    const taskList = await api.getClaimableTasks(config);
    console.log(formatTasks(taskList, getMode(opts)));
  });

tasks
  .command("get <task-id>")
  .description("Fetch a single task by id")
  .option("--json", "JSON output")
  .option("--quiet", "Only task ID")
  .action(async (taskId, opts) => {
    const config = loadConfig();
    const task = await api.getTask(config, taskId);
    console.log(formatTask(task, getMode(opts)));
  });

tasks
  .command("create <project-slug-or-id>")
  .description("Create a task in a project")
  .requiredOption("-t, --title <title>", "Task title (required)")
  .option("-d, --description <text>", "Task description")
  .option(
    "-p, --priority <level>",
    "Priority: LOW | MEDIUM | HIGH | CRITICAL",
  )
  .option("-w, --workflow <id>", "Workflow id (UUID)")
  .option("--due-at <iso>", "Due date (ISO 8601)")
  .option("--external-ref <ref>", "External reference (idempotency key)")
  .option(
    "-l, --label <label>",
    "Label (repeatable)",
    (value: string, acc: string[]) => acc.concat(value),
    [] as string[],
  )
  .option("--json", "JSON output")
  .option("--quiet", "Only task ID")
  .action(async (projectRef, opts) => {
    // Validate priority BEFORE hitting the network so a typo fails fast
    // without a wasted round-trip to resolve the project slug.
    if (
      opts.priority &&
      !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(opts.priority)
    ) {
      console.error(
        `Error: --priority must be one of LOW, MEDIUM, HIGH, CRITICAL (got: ${opts.priority})`,
      );
      process.exit(1);
    }

    const config = loadConfig();
    // Accept either a slug or a UUID. If it's a slug, resolve to id first
    // so we hit the canonical POST /api/projects/:id/tasks path. Wrap
    // the resolve error so a bad slug reads as "project not found"
    // rather than as a confusing CREATE failure.
    let projectId: string;
    if (api.isUuid(projectRef)) {
      projectId = projectRef;
    } else {
      try {
        projectId = (await api.getProject(config, projectRef)).id;
      } catch (err) {
        if (err instanceof api.ApiError && err.status === 404) {
          console.error(
            `Error: project '${projectRef}' not found (no match for slug or id).`,
          );
          process.exit(1);
        }
        throw err;
      }
    }

    const input: api.CreateTaskInput = { title: opts.title };
    if (opts.description) input.description = opts.description;
    if (opts.priority) input.priority = opts.priority;
    if (opts.workflow) input.workflowId = opts.workflow;
    if (opts.dueAt) input.dueAt = opts.dueAt;
    if (opts.externalRef) input.externalRef = opts.externalRef;
    if (opts.label && opts.label.length > 0) input.labels = opts.label;

    const task = await api.createTask(config, projectId, input);
    console.log(formatTask(task, getMode(opts)));
  });

tasks
  .command("claim <task-id>")
  .description("Claim a task")
  .option("--force", "Bypass confidence threshold")
  .option("--json", "JSON output")
  .option("--quiet", "Only task ID")
  .action(async (taskId, opts) => {
    const config = loadConfig();
    const task = await api.claimTask(config, taskId, opts.force);
    console.log(formatTask(task, getMode(opts)));
  });

tasks
  .command("status <task-id> <status>")
  .description("Transition task status (open, in_progress, review, done)")
  .option("--json", "JSON output")
  .option("--quiet", "Only task ID")
  .action(async (taskId, status, opts) => {
    const config = loadConfig();
    const task = await api.transitionTask(config, taskId, status);
    console.log(formatTask(task, getMode(opts)));
  });

tasks
  .command("release <task-id>")
  .description("Release a claimed task back to the claimable pool")
  .option("--json", "JSON output")
  .option("--quiet", "Only task ID")
  .action(async (taskId, opts) => {
    const config = loadConfig();
    const task = await api.releaseTask(config, taskId);
    console.log(formatTask(task, getMode(opts)));
  });

tasks
  .command("update <task-id>")
  .description("Update task fields (branchName, prUrl, prNumber, result)")
  .option("--branch <name>", "Branch name")
  .option("--pr-url <url>", "PR URL")
  .option("--pr-number <n>", "PR number")
  .option("--result <text>", "Result text")
  .option("--json", "JSON output")
  .option("--quiet", "Only task ID")
  .action(async (taskId, opts) => {
    const config = loadConfig();
    const data: Record<string, unknown> = {};
    if (opts.branch) data.branchName = opts.branch;
    if (opts.prUrl) data.prUrl = opts.prUrl;
    if (opts.prNumber) data.prNumber = Number(opts.prNumber);
    if (opts.result) data.result = opts.result;
    if (Object.keys(data).length === 0) {
      console.error("Error: No fields to update. Use --branch, --pr-url, --pr-number, or --result.");
      process.exit(1);
    }
    const task = await api.updateTask(config, taskId, data);
    console.log(formatTask(task, getMode(opts)));
  });

tasks
  .command("comment <task-id> <message>")
  .description("Add a comment to a task")
  .action(async (taskId, message) => {
    const config = loadConfig();
    await api.addComment(config, taskId, message);
    console.log("Comment added.");
  });

tasks
  .command("instructions <task-id>")
  .description("Get task instructions (agent context)")
  .action(async (taskId) => {
    const config = loadConfig();
    const instructions = await api.getTaskInstructions(config, taskId);
    console.log(JSON.stringify(instructions, null, 2));
  });

// ── Projects ────────────────────────────────────────────────────────────────

const projects = program
  .command("projects")
  .description("Project operations");

projects
  .command("list")
  .description("List all available projects")
  .option("--json", "JSON output")
  .option("--quiet", "Only project slugs")
  .action(async (opts) => {
    const config = loadConfig();
    const projectList = await api.listProjects(config);
    console.log(formatProjects(projectList, getMode(opts)));
  });

projects
  .command("get <slug-or-id>")
  .description("Fetch a single project by slug or UUID")
  .option("--json", "JSON output")
  .option("--quiet", "Only project ID")
  .action(async (slugOrId, opts) => {
    const config = loadConfig();
    const project = await api.getProject(config, slugOrId);
    console.log(formatProject(project, getMode(opts)));
  });

// ── GitHub delegation ───────────────────────────────────────────────────────

const github = program
  .command("github")
  .description("GitHub delegation operations");

const githubPr = github.command("pr").description("Pull request operations");

githubPr
  .command("create")
  .description("Create a pull request via GitHub delegation")
  .requiredOption("--task <id>", "Task id the PR belongs to")
  .requiredOption("--owner <owner>", "GitHub repo owner")
  .requiredOption("--repo <repo>", "GitHub repo name")
  .requiredOption("--head <branch>", "Head branch")
  .requiredOption("--base <branch>", "Base branch")
  .requiredOption("--title <title>", "PR title")
  .option("--body <text>", "PR body")
  .option("--json", "JSON output")
  .action(async (opts) => {
    const config = loadConfig();
    const pr = await api.createPullRequest(config, {
      taskId: opts.task,
      owner: opts.owner,
      repo: opts.repo,
      head: opts.head,
      base: opts.base,
      title: opts.title,
      body: opts.body,
    });
    if (opts.json) {
      console.log(JSON.stringify(pr, null, 2));
    } else {
      console.log(`PR #${pr.number}: ${pr.url}`);
    }
  });

githubPr
  .command("merge <pr-number>")
  .description("Merge a pull request via GitHub delegation")
  .requiredOption("--task <id>", "Task id the PR belongs to")
  .requiredOption("--owner <owner>", "GitHub repo owner")
  .requiredOption("--repo <repo>", "GitHub repo name")
  .option(
    "--method <method>",
    "Merge method: merge | squash | rebase (default: squash)",
    "squash",
  )
  .option("--json", "JSON output")
  .action(async (prNumberStr, opts) => {
    const prNumber = Number(prNumberStr);
    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      console.error(`Error: pr-number must be a positive integer (got: ${prNumberStr})`);
      process.exit(1);
    }
    if (!["merge", "squash", "rebase"].includes(opts.method)) {
      console.error(`Error: --method must be one of merge, squash, rebase (got: ${opts.method})`);
      process.exit(1);
    }
    const config = loadConfig();
    const result = await api.mergePullRequest(config, prNumber, {
      taskId: opts.task,
      owner: opts.owner,
      repo: opts.repo,
      merge_method: opts.method as "merge" | "squash" | "rebase",
    });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Merged: ${result.merged}${result.sha ? ` (${result.sha})` : ""}`);
    }
  });

githubPr
  .command("comment <pr-number> <body>")
  .description("Comment on a pull request via GitHub delegation")
  .requiredOption("--task <id>", "Task id the PR belongs to")
  .requiredOption("--owner <owner>", "GitHub repo owner")
  .requiredOption("--repo <repo>", "GitHub repo name")
  .action(async (prNumberStr, body, opts) => {
    const prNumber = Number(prNumberStr);
    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      console.error(`Error: pr-number must be a positive integer (got: ${prNumberStr})`);
      process.exit(1);
    }
    const config = loadConfig();
    await api.commentPullRequest(config, prNumber, {
      taskId: opts.task,
      owner: opts.owner,
      repo: opts.repo,
      body,
    });
    console.log(`Commented on PR #${prNumber}.`);
  });

// ── Review ──────────────────────────────────────────────────────────────────

const review = program
  .command("review")
  .description("Review operations");

review
  .command("approve <task-id>")
  .description("Approve a task")
  .option("-c, --comment <text>", "Review comment")
  .option("--json", "JSON output")
  .option("--quiet", "Only task ID")
  .action(async (taskId, opts) => {
    const config = loadConfig();
    const task = await api.reviewTask(config, taskId, "approve", opts.comment);
    console.log(formatTask(task, getMode(opts)));
  });

review
  .command("request-changes <task-id>")
  .description("Request changes on a task")
  .option("-c, --comment <text>", "Review comment")
  .option("--json", "JSON output")
  .option("--quiet", "Only task ID")
  .action(async (taskId, opts) => {
    const config = loadConfig();
    const task = await api.reviewTask(config, taskId, "request_changes", opts.comment);
    console.log(formatTask(task, getMode(opts)));
  });

review
  .command("claim <task-id>")
  .description("Claim the review lock on a task")
  .option("--json", "JSON output")
  .action(async (taskId, opts) => {
    const config = loadConfig();
    const task = await api.claimReview(config, taskId);
    if (opts.json) console.log(JSON.stringify(task, null, 2));
    else console.log(`Review claimed: ${task.id}`);
  });

review
  .command("release <task-id>")
  .description("Release the review lock")
  .action(async (taskId) => {
    const config = loadConfig();
    await api.releaseReview(config, taskId);
    console.log("Review lock released.");
  });

// ── Run ─────────────────────────────────────────────────────────────────────

program.parseAsync().catch((err) => {
  if (err instanceof api.ApiError) {
    console.error(`API error (${err.status}): ${JSON.stringify(err.body, null, 2)}`);
  } else {
    console.error(`Error: ${err.message}`);
  }
  process.exit(1);
});
