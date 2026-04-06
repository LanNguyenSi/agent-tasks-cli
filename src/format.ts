/**
 * Output formatting helpers.
 */
import type { Task, Signal } from "./api.js";

export type OutputMode = "table" | "json" | "quiet";

export function formatTasks(tasks: Task[], mode: OutputMode): string {
  if (mode === "json") return JSON.stringify(tasks, null, 2);
  if (mode === "quiet") return tasks.map((t) => t.id).join("\n");

  if (tasks.length === 0) return "No tasks found.";

  const lines = tasks.map((t) => {
    const project = t.project?.slug ?? "";
    const prio = t.priority.padEnd(8);
    const status = t.status.padEnd(12);
    return `${prio} ${status} ${project.padEnd(20)} ${t.title}`;
  });
  return `${"PRIORITY".padEnd(8)} ${"STATUS".padEnd(12)} ${"PROJECT".padEnd(20)} TITLE\n${lines.join("\n")}`;
}

export function formatTask(task: Task, mode: OutputMode): string {
  if (mode === "json") return JSON.stringify(task, null, 2);
  if (mode === "quiet") return task.id;

  const lines = [
    `ID:       ${task.id}`,
    `Title:    ${task.title}`,
    `Status:   ${task.status}`,
    `Priority: ${task.priority}`,
  ];
  if (task.branchName) lines.push(`Branch:   ${task.branchName}`);
  if (task.prUrl) lines.push(`PR:       ${task.prUrl}`);
  return lines.join("\n");
}

export function formatSignals(signals: Signal[], mode: OutputMode): string {
  if (mode === "json") return JSON.stringify(signals, null, 2);
  if (mode === "quiet") return signals.map((s) => s.id).join("\n");

  if (signals.length === 0) return "No signals.";

  const lines = signals.map((s) => {
    const ctx = s.context as Record<string, unknown>;
    const title = (ctx.taskTitle as string) ?? s.taskId;
    const time = new Date(s.createdAt).toLocaleString();
    return `${s.type.padEnd(22)} ${title.substring(0, 40).padEnd(42)} ${time}`;
  });
  return `${"TYPE".padEnd(22)} ${"TASK".padEnd(42)} CREATED\n${lines.join("\n")}`;
}
