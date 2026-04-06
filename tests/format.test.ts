import { describe, expect, it } from "vitest";
import { formatTasks, formatTask, formatSignals } from "../src/format.js";

describe("formatTasks", () => {
  const tasks = [
    { id: "t1", title: "Fix bug", status: "open", priority: "HIGH", project: { name: "p", slug: "p" } },
    { id: "t2", title: "Add feature", status: "review", priority: "MEDIUM", project: { name: "p", slug: "p" } },
  ];

  it("formats as table by default", () => {
    const out = formatTasks(tasks, "table");
    expect(out).toContain("Fix bug");
    expect(out).toContain("HIGH");
    expect(out).toContain("PRIORITY");
  });

  it("formats as JSON", () => {
    const out = formatTasks(tasks, "json");
    const parsed = JSON.parse(out);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe("t1");
  });

  it("formats as quiet (IDs only)", () => {
    const out = formatTasks(tasks, "quiet");
    expect(out).toBe("t1\nt2");
  });

  it("shows message for empty list", () => {
    expect(formatTasks([], "table")).toBe("No tasks found.");
  });
});

describe("formatTask", () => {
  const task = { id: "t1", title: "Fix bug", status: "review", priority: "HIGH", branchName: "feat/fix", prUrl: "https://pr/1" };

  it("shows task details", () => {
    const out = formatTask(task, "table");
    expect(out).toContain("Fix bug");
    expect(out).toContain("feat/fix");
    expect(out).toContain("https://pr/1");
  });

  it("returns just ID in quiet mode", () => {
    expect(formatTask(task, "quiet")).toBe("t1");
  });
});

describe("formatSignals", () => {
  const signals = [
    { id: "s1", type: "review_needed", taskId: "t1", projectId: "p1", context: { taskTitle: "Fix bug" }, acknowledgedAt: null, createdAt: "2026-04-06T12:00:00Z" },
  ];

  it("formats signal list", () => {
    const out = formatSignals(signals, "table");
    expect(out).toContain("review_needed");
    expect(out).toContain("Fix bug");
  });

  it("shows message for empty list", () => {
    expect(formatSignals([], "table")).toBe("No signals.");
  });

  it("formats as JSON", () => {
    const out = formatSignals(signals, "json");
    expect(JSON.parse(out)).toHaveLength(1);
  });
});
