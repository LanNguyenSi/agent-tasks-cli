/**
 * Thin API client for agent-tasks.
 */
import type { Config } from "./config.js";

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API error ${status}: ${typeof body === "object" ? JSON.stringify(body) : body}`);
  }
}

async function request<T>(config: Config, path: string, init?: RequestInit): Promise<T> {
  const url = `${config.endpoint}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = await res.json() as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// ── Signals ─────────────────────────────────────────────────────────────────

export interface Signal {
  id: string;
  type: string;
  taskId: string;
  projectId: string;
  context: Record<string, unknown>;
  acknowledgedAt: string | null;
  createdAt: string;
}

export async function getSignals(config: Config, status = "unread", limit = 50): Promise<Signal[]> {
  const { signals } = await request<{ signals: Signal[] }>(
    config, `/api/agent/signals?status=${status}&limit=${limit}`,
  );
  return signals;
}

export async function ackSignal(config: Config, signalId: string): Promise<Signal> {
  const { signal } = await request<{ signal: Signal }>(
    config, `/api/agent/signals/${signalId}/ack`, { method: "POST" },
  );
  return signal;
}

// ── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  githubRepo?: string | null;
}

export async function listProjects(config: Config): Promise<Project[]> {
  const { projects } = await request<{ projects: Project[] }>(
    config,
    "/api/projects/available",
  );
  return projects;
}

/**
 * Slugs are lowercase alphanumeric + dashes; IDs are UUIDs. Shared
 * detection helper so callers in `index.ts` don't re-implement the
 * regex and drift from the server's id shape.
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function getProject(
  config: Config,
  slugOrId: string,
): Promise<Project> {
  const path = isUuid(slugOrId)
    ? `/api/projects/${slugOrId}`
    : `/api/projects/by-slug/${encodeURIComponent(slugOrId)}`;
  const { project } = await request<{ project: Project }>(config, path);
  return project;
}

// ── Tasks ───────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  branchName?: string | null;
  prUrl?: string | null;
  prNumber?: number | null;
  claimedByAgentId?: string | null;
  project?: { name: string; slug: string };
}

export async function getClaimableTasks(config: Config): Promise<Task[]> {
  const { tasks } = await request<{ tasks: Task[] }>(config, "/api/tasks/claimable");
  return tasks;
}

export async function getTask(config: Config, taskId: string): Promise<Task> {
  const { task } = await request<{ task: Task }>(
    config,
    `/api/tasks/${taskId}`,
  );
  return task;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  workflowId?: string;
  dueAt?: string;
  externalRef?: string;
  labels?: string[];
}

export async function createTask(
  config: Config,
  projectId: string,
  input: CreateTaskInput,
): Promise<Task> {
  const { task } = await request<{ task: Task }>(
    config,
    `/api/projects/${projectId}/tasks`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return task;
}

export async function claimTask(config: Config, taskId: string, force = false): Promise<Task> {
  const { task } = await request<{ task: Task }>(
    config, `/api/tasks/${taskId}/claim${force ? "?force=true" : ""}`, { method: "POST" },
  );
  return task;
}

export async function releaseTask(config: Config, taskId: string): Promise<Task> {
  const { task } = await request<{ task: Task }>(
    config,
    `/api/tasks/${taskId}/release`,
    { method: "POST" },
  );
  return task;
}

export async function transitionTask(config: Config, taskId: string, status: string): Promise<Task> {
  const { task } = await request<{ task: Task }>(
    config, `/api/tasks/${taskId}/transition`,
    { method: "POST", body: JSON.stringify({ status }) },
  );
  return task;
}

export async function updateTask(config: Config, taskId: string, data: Record<string, unknown>): Promise<Task> {
  const { task } = await request<{ task: Task }>(
    config, `/api/tasks/${taskId}`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
  return task;
}

export async function addComment(config: Config, taskId: string, content: string): Promise<unknown> {
  return request(config, `/api/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function getTaskInstructions(config: Config, taskId: string): Promise<unknown> {
  return request(config, `/api/tasks/${taskId}/instructions`);
}

// ── Reviews ─────────────────────────────────────────────────────────────────

export async function reviewTask(config: Config, taskId: string, action: "approve" | "request_changes", comment?: string): Promise<Task> {
  const { task } = await request<{ task: Task }>(
    config, `/api/tasks/${taskId}/review`,
    { method: "POST", body: JSON.stringify({ action, comment }) },
  );
  return task;
}

export async function claimReview(config: Config, taskId: string): Promise<Task> {
  const { task } = await request<{ task: Task }>(
    config, `/api/tasks/${taskId}/review/claim`, { method: "POST" },
  );
  return task;
}

export async function releaseReview(config: Config, taskId: string): Promise<Task> {
  const { task } = await request<{ task: Task }>(
    config, `/api/tasks/${taskId}/review/release`, { method: "POST" },
  );
  return task;
}

// ── GitHub delegation ───────────────────────────────────────────────────────
//
// These three endpoints delegate GitHub operations (PR create/merge/comment)
// to a team member with `allowAgentPr*` consent. The server resolves the
// delegation user at call time — CLI just forwards the request.

export interface PullRequestRef {
  number: number;
  url: string;
  title?: string;
}

export interface CreatePullRequestInput {
  taskId: string;
  owner: string;
  repo: string;
  head: string;
  base: string;
  title: string;
  body?: string;
}

export async function createPullRequest(
  config: Config,
  input: CreatePullRequestInput,
): Promise<PullRequestRef> {
  const { pullRequest } = await request<{ pullRequest: PullRequestRef }>(
    config,
    "/api/github/pull-requests",
    { method: "POST", body: JSON.stringify(input) },
  );
  return pullRequest;
}

export interface MergePullRequestInput {
  taskId: string;
  owner: string;
  repo: string;
  // snake_case matches the backend schema (GitHub's own merge API uses
  // the same casing). Don't "fix" this in a refactor — it would break
  // the wire format.
  merge_method?: "merge" | "squash" | "rebase";
}

export async function mergePullRequest(
  config: Config,
  prNumber: number,
  input: MergePullRequestInput,
): Promise<{ merged: boolean; sha?: string; message?: string }> {
  return request<{ merged: boolean; sha?: string; message?: string }>(
    config,
    `/api/github/pull-requests/${prNumber}/merge`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export interface CommentPullRequestInput {
  taskId: string;
  owner: string;
  repo: string;
  body: string;
}

export async function commentPullRequest(
  config: Config,
  prNumber: number,
  input: CommentPullRequestInput,
): Promise<unknown> {
  return request(
    config,
    `/api/github/pull-requests/${prNumber}/comments`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
