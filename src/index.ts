#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import * as api from "./api.js";
import { formatTasks, formatTask, formatSignals, type OutputMode } from "./format.js";

const program = new Command();

function getMode(opts: { json?: boolean; quiet?: boolean }): OutputMode {
  if (opts.json) return "json";
  if (opts.quiet) return "quiet";
  return "table";
}

program
  .name("agent-tasks")
  .description("CLI client for agent-tasks — task management for local AI agents")
  .version("0.1.0");

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
