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

// ── Tasks ───────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
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

export async function claimTask(config: Config, taskId: string, force = false): Promise<Task> {
  const { task } = await request<{ task: Task }>(
    config, `/api/tasks/${taskId}/claim${force ? "?force=true" : ""}`, { method: "POST" },
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
