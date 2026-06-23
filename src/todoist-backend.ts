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

// --- Content split/merge for Todoist's 500-char title limit ---
// Sentinel "→" signals that the title was truncated and description holds the full text.

export const CONTENT_LIMIT = 500;
export const TRUNCATION_SENTINEL = "→";

/**
 * Split stream content into Todoist content (title) + description.
 * - First line becomes the title; remaining lines become description.
 * - If the first line exceeds 500 chars, truncate at 499 + "→" and
 *   put the full original text into description.
 */
export function splitContent(text: string): { content: string; description: string } {
  const newlineIdx = text.indexOf("\n");
  const title = newlineIdx === -1 ? text : text.slice(0, newlineIdx);
  const body = newlineIdx === -1 ? "" : text.slice(newlineIdx + 1);

  if (title.length <= CONTENT_LIMIT) {
    return { content: title, description: body };
  }

  return {
    content: title.slice(0, CONTENT_LIMIT - 1) + TRUNCATION_SENTINEL,
    description: text,
  };
}

/**
 * Merge Todoist content + description back into a single stream content string.
 * - If title ends with "→" and description exists: description is the full text.
 * - If description exists without sentinel: title + "\n\n" + description.
 * - No description: just the title.
 */
export function mergeContent(content: string, description?: string | null): string {
  if (!description) return content;

  if (content.endsWith(TRUNCATION_SENTINEL)) {
    return description;
  }

  return content + "\n\n" + description;
}

/**
 * Todoist "uncompletable" tasks have a name prefixed with "* " (asterisk + space).
 * They render as headers/notes with no checkbox and aren't real stream items, so
 * we hide them from clients entirely.
 */
function isUncompletable(task: Task): boolean {
  return task.content.startsWith("* ");
}

function taskToStreamItem(task: Task, displayId: string): StreamItem {
  const type = PRIORITY_TO_TYPE[task.priority] ?? "task";
  // Use due.date as startDate (stream semantics), fall back to addedAt date
  const startDate =
    task.due?.date ?? (task.addedAt ? task.addedAt.slice(0, 10) : todayStr());

  return {
    id: task.id,
    displayId,
    type,
    content: mergeContent(task.content, task.description),
    startDate,
    deadline: task.deadline?.date ?? null,
    resolvedAt: task.completedAt ?? null,
    createdAt: task.addedAt ?? new Date().toISOString(),
  };
}

export interface TodoistBackendOptions {
  /**
   * When true, route HTTP through the global `fetch` instead of the SDK's
   * default dispatcher. Required on Cloudflare Workers: the SDK detects Node
   * via `process.versions.node` (which the `nodejs_compat` flag sets), then
   * tries to `import('undici')` — which needs `worker_threads`/`MessagePort`
   * that Workers doesn't ship.
   */
  useNativeFetch?: boolean;
}

/**
 * Workers-compatible adapter for the Todoist SDK's `customFetch` option.
 *
 * Skips the SDK's default dispatcher (which lazy-imports `undici` and breaks
 * on Cloudflare Workers — see `TodoistBackendOptions.useNativeFetch` above).
 * Wraps the global `fetch` so the result satisfies the SDK's CustomFetchResponse
 * shape: ok/status/statusText/headers + text()/json() that can each be called once.
 */
function nativeFetchAdapter(
  url: string,
  options?: RequestInit & { timeout?: number },
): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text(): Promise<string>;
  json(): Promise<unknown>;
}> {
  const { timeout: _timeout, ...init } = options ?? {};
  return fetch(url, init).then((resp) => {
    const headers: Record<string, string> = {};
    resp.headers.forEach((v, k) => {
      headers[k] = v;
    });
    // SDK calls text() OR json(), never both — no need to clone.
    return {
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      headers,
      text: () => resp.text(),
      json: () => resp.json(),
    };
  });
}

export class TodoistBackend implements StreamBackend {
  private api: TodoistApi;
  private projectId: string | undefined;

  constructor(token: string, projectId?: string, options?: TodoistBackendOptions) {
    this.api = options?.useNativeFetch
      ? new TodoistApi(token, { customFetch: nativeFetchAdapter as never })
      : new TodoistApi(token);
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
    const { content, description } = splitContent(params.content);
    const task = await this.api.addTask({
      content,
      ...(description ? { description } : {}),
      priority: TYPE_TO_PRIORITY[params.type],
      ...(isFuture ? { dueDate: params.startDate } : {}),
      ...(params.deadline ? { deadlineDate: params.deadline } : {}),
      ...(this.projectId ? { projectId: this.projectId } : {}),
    } as Parameters<typeof this.api.addTask>[0]);

    // Skip the paginated active-set fetch on add — return an optimistic short ID
    // (last 4 chars). The next query will canonicalize it against the full set.
    return taskToStreamItem(task, task.id.slice(-4));
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
    const { content: splitTitle, description: splitDesc } = splitContent(newContent);
    const newTask = await this.api.addTask({
      content: splitTitle,
      ...(splitDesc ? { description: splitDesc } : {}),
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

    // Compute display IDs once over the union (old + new) so both render against the same set.
    const shortIds = computeShortIds([...allIds, newTask.id]);
    const oldDisplayId = shortIds.get(oldTask.id) ?? oldTask.id.slice(-4);
    const newDisplayId = shortIds.get(newTask.id) ?? newTask.id.slice(-4);

    const oldItem = taskToStreamItem(oldTask, oldDisplayId);
    oldItem.resolvedAt = new Date().toISOString();

    const newItem = taskToStreamItem(newTask, newDisplayId);
    newItem.restreamedFrom = oldTask.id;

    return { old: oldItem, new: newItem };
  }

  async query(filters: QueryFilters): Promise<StreamItem[]> {
    const today = todayStr();

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

    // Hide "uncompletable" header/note tasks ("* ...") from the stream entirely.
    const tasks = allTasks.filter((t) => !isUncompletable(t));

    // Auto-clear due dates on tasks that have entered the stream (due <= today)
    const today = todayStr();
    const stale = tasks.filter((t) => t.due && t.due.date <= today);
    await Promise.all(
      stale.map((t) =>
        this.api.updateTask(t.id, { dueString: null }).then(() => {
          t.due = undefined as unknown as typeof t.due;
        }).catch(() => {}),
      ),
    );

    return tasks;
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

      // Hide "uncompletable" header/note tasks ("* ...") from the stream entirely.
      return allTasks.filter((t) => !isUncompletable(t));
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
      if (task && !isUncompletable(task)) return { task, shortIds, allIds };
    } catch {
      // Not found
    }

    return { task: null, shortIds, allIds };
  }
}
