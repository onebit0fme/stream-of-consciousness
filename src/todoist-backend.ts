import { TodoistApi } from "@doist/todoist-api-typescript";
import type { Task } from "@doist/todoist-api-typescript";
import { StreamBackend } from "./backend.js";
import { ItemType, StreamItem, QueryFilters } from "./types.js";
import {
  todayStr,
  daysBetween,
  decayProgress,
  computeShortIds,
  resolveShortId,
} from "./utils.js";

// --- Priority Mapping ---
// Todoist API: priority 4 = P1/urgent/red, 1 = P4/normal
// Stream: task=P1, thought=P2, idea=P3, output=P4

const TYPE_TO_PRIORITY: Record<ItemType, number> = {
  task: 4,
  thought: 3,
  idea: 2,
  output: 1,
};

const PRIORITY_TO_TYPE: Record<number, ItemType> = {
  4: "task",
  3: "thought",
  2: "idea",
  1: "output",
};

function taskToStreamItem(task: Task, displayId: string): StreamItem {
  const type = PRIORITY_TO_TYPE[task.priority] ?? "task";
  // Use due.date as startDate (stream semantics), fall back to addedAt date
  const startDate =
    task.due?.date ?? (task.addedAt ? task.addedAt.slice(0, 10) : todayStr());

  return {
    id: task.id,
    displayId,
    type,
    content: task.content,
    startDate,
    deadline: task.deadline?.date ?? null,
    resolvedAt: task.completedAt ?? null,
    createdAt: task.addedAt ?? new Date().toISOString(),
  };
}

export class TodoistBackend implements StreamBackend {
  private api: TodoistApi;
  private projectId: string | undefined;

  constructor(token: string, projectId?: string) {
    this.api = new TodoistApi(token);
    this.projectId = projectId;
  }

  async add(params: {
    content: string;
    type: ItemType;
    startDate: string;
    deadline: string | null;
  }): Promise<StreamItem> {
    // Only set due date for future start dates; items entering the stream today need no date
    const isFuture = params.startDate > todayStr();
    const task = await this.api.addTask({
      content: params.content,
      priority: TYPE_TO_PRIORITY[params.type],
      ...(isFuture ? { dueDate: params.startDate } : {}),
      ...(params.deadline ? { deadlineDate: params.deadline } : {}),
      ...(this.projectId ? { projectId: this.projectId } : {}),
    } as Parameters<typeof this.api.addTask>[0]);

    // Compute display ID against all active tasks for global uniqueness
    const active = await this.fetchAllActiveTasks();
    const allIds = active.map((t) => t.id);
    if (!allIds.includes(task.id)) allIds.push(task.id);
    const shortIds = computeShortIds(allIds);

    return taskToStreamItem(task, shortIds.get(task.id) ?? task.id.slice(-4));
  }

  async resolve(id: number | string): Promise<StreamItem | null> {
    const strId = String(id);
    const { task, shortIds } = await this.findTaskWithContext(strId);
    if (!task) return null;

    await this.api.closeTask(task.id);

    const displayId = shortIds.get(task.id) ?? task.id.slice(-4);
    const item = taskToStreamItem(task, displayId);
    item.resolvedAt = new Date().toISOString();
    return item;
  }

  async restream(
    id: number | string,
    changes: {
      content?: string;
      type?: ItemType;
      startDate?: string;
      deadline?: string | null;
    },
  ): Promise<{ old: StreamItem; new: StreamItem } | null> {
    const strId = String(id);
    const { task: oldTask, allIds } = await this.findTaskWithContext(strId);
    if (!oldTask) return null;

    const oldType = PRIORITY_TO_TYPE[oldTask.priority] ?? "task";
    const today = todayStr();

    // Close old task
    await this.api.closeTask(oldTask.id);

    // Create new task
    const newType = changes.type ?? oldType;
    const newContent = changes.content ?? oldTask.content;
    const newStartDate = changes.startDate ?? today;
    const newDeadline =
      changes.deadline !== undefined
        ? changes.deadline
        : oldTask.deadline?.date ?? null;

    const isFuture = newStartDate > today;
    const newTask = await this.api.addTask({
      content: newContent,
      priority: TYPE_TO_PRIORITY[newType],
      ...(isFuture ? { dueDate: newStartDate } : {}),
      ...(newDeadline ? { deadlineDate: newDeadline } : {}),
      ...(this.projectId ? { projectId: this.projectId } : {}),
    } as Parameters<typeof this.api.addTask>[0]);

    // Add lineage comment on the new task
    try {
      await this.api.addComment({
        taskId: newTask.id,
        content: `Restreamed from: ${oldTask.url}`,
      });
    } catch {
      // Non-fatal: lineage comment is nice-to-have
    }

    // Compute display IDs with the new task included
    const updatedIds = allIds.filter((i) => i !== oldTask.id);
    updatedIds.push(newTask.id);
    const shortIds = computeShortIds(updatedIds);

    const oldDisplayId = computeShortIds([...allIds]).get(oldTask.id) ?? oldTask.id.slice(-4);
    const newDisplayId = shortIds.get(newTask.id) ?? newTask.id.slice(-4);

    const oldItem = taskToStreamItem(oldTask, oldDisplayId);
    oldItem.resolvedAt = new Date().toISOString();

    const newItem = taskToStreamItem(newTask, newDisplayId);
    newItem.restreamedFrom = oldTask.id;

    return { old: oldItem, new: newItem };
  }

  async query(filters: QueryFilters): Promise<StreamItem[]> {
    const today = todayStr();

    // Always fetch full active set for globally unique short IDs
    const allActive = await this.fetchAllActiveTasks();
    const allActiveIds = allActive.map((t) => t.id);

    let tasks: Task[] = [];

    if (filters.status === "active" || filters.status === "all") {
      // Only include items whose start date (due date) has arrived
      const inStream = allActive.filter(
        (t) => !t.due || t.due.date <= today
      );
      tasks.push(...inStream);
    }

    if (filters.status === "resolved" || filters.status === "all") {
      const resolved = await this.fetchCompletedTasks();
      tasks.push(...resolved);
      // Include resolved IDs in the short ID pool for uniqueness
      allActiveIds.push(...resolved.map((t) => t.id));
    }

    // Substring search
    if (filters.query) {
      const lower = filters.query.toLowerCase();
      tasks = tasks.filter((t) =>
        t.content.toLowerCase().includes(lower)
      );
    }

    // Type filter (via priority mapping)
    if (filters.type && filters.type.length > 0) {
      const priorities = filters.type.map((t) => TYPE_TO_PRIORITY[t]);
      tasks = tasks.filter((t) => priorities.includes(t.priority));
    }

    // Decay filters (active items only)
    if (filters.decay_min !== undefined) {
      tasks = tasks.filter((t) => {
        if (t.completedAt) return false;
        const item = taskToStreamItem(t, "");
        return decayProgress(item, today) >= filters.decay_min!;
      });
    }

    if (filters.decay_max !== undefined) {
      tasks = tasks.filter((t) => {
        if (t.completedAt) return false;
        const item = taskToStreamItem(t, "");
        return decayProgress(item, today) < filters.decay_max!;
      });
    }

    // Deadline filter
    if (filters.deadline_within !== undefined) {
      tasks = tasks.filter((t) => {
        if (!t.deadline) return false;
        const daysLeft = daysBetween(today, t.deadline.date);
        return daysLeft <= filters.deadline_within!;
      });
    }

    // Compute short IDs against the FULL set for global uniqueness
    const shortIds = computeShortIds(allActiveIds);

    return tasks.map((t) =>
      taskToStreamItem(t, shortIds.get(t.id) ?? t.id.slice(0, 4))
    );
  }

  // --- Private helpers ---

  /**
   * Fetch all active tasks, handling pagination.
   */
  private async fetchAllActiveTasks(): Promise<Task[]> {
    const allTasks: Task[] = [];
    let cursor: string | null = null;

    do {
      const args: Record<string, unknown> = {};
      if (this.projectId) args.projectId = this.projectId;
      if (cursor) args.cursor = cursor;

      const response = await this.api.getTasks(args);
      allTasks.push(...response.results);
      cursor = response.nextCursor;
    } while (cursor);

    // Auto-clear due dates on tasks that have entered the stream (due <= today)
    const today = todayStr();
    const stale = allTasks.filter((t) => t.due && t.due.date <= today);
    await Promise.all(
      stale.map((t) =>
        this.api.updateTask(t.id, { dueString: null }).then(() => {
          t.due = undefined as unknown as typeof t.due;
        }).catch(() => {}),
      ),
    );

    return allTasks;
  }

  /**
   * Fetch completed tasks from the last 90 days, handling pagination.
   */
  private async fetchCompletedTasks(): Promise<Task[]> {
    try {
      const allTasks: Task[] = [];
      const now = new Date();
      const since = new Date(now.getTime() - 90 * 86400000);
      let cursor: string | null = null;

      do {
        const args: Record<string, unknown> = {
          since: since.toISOString(),
          until: now.toISOString(),
        };
        if (this.projectId) args.projectId = this.projectId;
        if (cursor) args.cursor = cursor;

        const response = await this.api.getCompletedTasksByCompletionDate(
          args as Parameters<typeof this.api.getCompletedTasksByCompletionDate>[0],
        );
        allTasks.push(...response.items);
        cursor = response.nextCursor;
      } while (cursor);

      return allTasks;
    } catch {
      // Completed tasks API may not be available on all plans
      return [];
    }
  }

  /**
   * Find a task by full ID or short suffix, returning context for display ID computation.
   */
  private async findTaskWithContext(
    input: string,
  ): Promise<{ task: Task | null; shortIds: Map<string, string>; allIds: string[] }> {
    const active = await this.fetchAllActiveTasks();
    const allIds = active.map((t) => t.id);
    const shortIds = computeShortIds(allIds);

    // Try exact match on full ID
    const exactMatch = active.find((t) => t.id === input);
    if (exactMatch) {
      return { task: exactMatch, shortIds, allIds };
    }

    // Try suffix match
    const fullId = resolveShortId(input, allIds);
    if (fullId) {
      const task = active.find((t) => t.id === fullId) ?? null;
      return { task, shortIds, allIds };
    }

    // Try direct API fetch (for IDs not in active set, e.g. completed)
    try {
      const task = await this.api.getTask(input);
      if (task) return { task, shortIds, allIds };
    } catch {
      // Not found
    }

    return { task: null, shortIds, allIds };
  }
}
