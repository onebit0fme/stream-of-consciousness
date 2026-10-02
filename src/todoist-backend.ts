import { TodoistApi } from "@doist/todoist-api-typescript";
import type { Task, Section, Comment } from "@doist/todoist-api-typescript";
import {
  StreamBackend,
  RestreamResult,
  UpdateResult,
  AddParams,
  RestreamChanges,
  UpdateChanges,
} from "./backend.js";
import {
  ItemId,
  ItemType,
  Outcome,
  PastWording,
  StreamItem,
  QueryFilters,
} from "./types.js";
import {
  todayStr,
  daysBetween,
  decayProgress,
  computeShortIds,
  resolveShortId,
  isUnchangedRestream,
  isRestreamed,
  applyRestream,
} from "./utils.js";

// --- Section mapping ---
// Type is the task's Todoist section. A run lives in the `Run` section, created
// on demand; `drift` lives in no section, so an unsectioned task, or one in any
// unrecognized section, reads as `drift`.
const RUN_SECTION = "Run";

// Section names that carry a type when read.
const SECTION_NAME_TO_TYPE: Record<string, ItemType> = {
  [RUN_SECTION]: "run",
  Live: "run",
  Pull: "run",
  Muse: "drift",
};

/** Build a section-id → type map, keeping only the sections that name a type. */
function buildSectionTypes(sections: Section[]): Map<string, ItemType> {
  const map = new Map<string, ItemType>();
  for (const s of sections) {
    const type = SECTION_NAME_TO_TYPE[s.name];
    if (type) map.set(s.id, type);
  }
  return map;
}

/** A task's type, from its section (unsectioned/other section → drift). */
function typeForTask(task: Task, sectionTypes: Map<string, ItemType>): ItemType {
  if (!task.sectionId) return "drift";
  return sectionTypes.get(task.sectionId) ?? "drift";
}

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
  // The blank line between summary and details is restored by mergeContent, so
  // it isn't stored — keeping it would add one more on every round trip.
  const body = newlineIdx === -1 ? "" : text.slice(newlineIdx + 1).replace(/^\n+/, "");

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

// --- Restream log ---
// An item's earlier wordings ride at the end of the task's text, one dated line
// each, most recent first:
//   ↻ 2026-09-28 Create Stripe account
//   ↻ 2026-09-22 Set up billing
const LOG_MARK = "↻";
const LOG_LINE = new RegExp(`^${LOG_MARK} (\\d{4}-\\d{2}-\\d{2}) (.*)$`);

/** Append the restream log to an item's content (unchanged when there is no history). */
export function withLog(content: string, history: PastWording[]): string {
  if (history.length === 0) return content;
  const lines = history.map((h) => `${LOG_MARK} ${h.date} ${h.content}`);
  return `${content}\n\n${lines.join("\n")}`;
}

/** Separate a task's text into the item's content and the restream log trailing it. */
export function splitLog(text: string): { content: string; history: PastWording[] } {
  const lines = text.split("\n");
  const history: PastWording[] = [];
  while (lines.length > 0) {
    const match = LOG_LINE.exec(lines[lines.length - 1]);
    if (!match) break;
    history.unshift({ date: match[1], content: match[2] });
    lines.pop();
  }
  if (history.length === 0) return { content: text, history };
  return { content: lines.join("\n").trimEnd(), history };
}

// --- Comment folding ---
// A task's comments are folded into its content (oldest first), so notes added
// in the Todoist app surface in the stream and get carried into the body on
// restream.
export function foldComments(
  content: string,
  comments: Array<{ content: string; postedAt: string }>,
): string {
  const notes = comments
    .filter((c) => c.content.trim().length > 0)
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt))
    .map((c) => c.content.trim());
  if (notes.length === 0) return content;
  return [content, ...notes].join("\n\n");
}

/**
 * Todoist "uncompletable" tasks have a name prefixed with "* " (asterisk + space).
 * They render as headers/notes with no checkbox and aren't real stream items, so
 * we hide them from clients entirely.
 */
function isUncompletable(task: Task): boolean {
  return task.content.startsWith("* ");
}

/** Stream start date for a task: its due date (stream semantics), else the date it was added. */
function taskStartDate(task: Task): string {
  return task.due?.date ?? (task.addedAt ? task.addedAt.slice(0, 10) : todayStr());
}

function taskToStreamItem(
  task: Task,
  displayId: string,
  type: ItemType,
  comments: Comment[] = [],
): StreamItem {
  const { content, history } = splitLog(mergeContent(task.content, task.description));
  return {
    id: task.id,
    displayId,
    type,
    content: foldComments(content, comments),
    startDate: taskStartDate(task),
    deadline: task.deadline?.date ?? null,
    history,
    resolvedAt: task.completedAt ?? null,
    outcome: task.completedAt ? "resolved" : null,
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

/**
 * Drain a cursor-paginated Todoist endpoint into a flat array. `fetchPage`
 * issues one request for the given cursor and normalizes the response to
 * `{ items, nextCursor }`, hiding the SDK's `.results` vs `.items` shape split.
 */
async function collectPaginated<T>(
  fetchPage: (cursor: string | null) => Promise<{ items: T[]; nextCursor: string | null }>,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  do {
    const { items, nextCursor } = await fetchPage(cursor);
    all.push(...items);
    cursor = nextCursor;
  } while (cursor);
  return all;
}

export class TodoistBackend implements StreamBackend {
  private api: TodoistApi;
  private projectId: string | undefined;
  // Resolved lazily and cached, only in no-project mode, to place sections/tasks in the Inbox.
  private inboxProjectId: string | undefined;

  constructor(token: string, projectId?: string, options?: TodoistBackendOptions) {
    this.api = options?.useNativeFetch
      ? new TodoistApi(token, { customFetch: nativeFetchAdapter as never })
      : new TodoistApi(token);
    this.projectId = projectId;
  }

  async add(params: AddParams): Promise<StreamItem> {
    const sectionId = await this.resolveSectionId(params.type);
    const task = await this.createTask(params, sectionId);

    // Skip the paginated active-set fetch on add — return an optimistic short ID
    // (last 4 chars). The next query will canonicalize it against the full set.
    return taskToStreamItem(task, task.id.slice(-4), params.type);
  }

  // Todoist has one way for a task to leave — completing it — so the outcome is
  // reported back to the caller but not stored on the task.
  async resolve(id: ItemId, outcome: Outcome): Promise<StreamItem | null> {
    const strId = String(id);
    const [{ task, shortIds }, sectionTypes] = await Promise.all([
      this.findTaskWithContext(strId),
      this.fetchSectionTypes(),
    ]);
    if (!task) return null;

    const displayId = shortIds.get(task.id) ?? task.id.slice(-4);
    // Close and read comments together — the comment read doesn't depend on the close.
    const [, comments] = await Promise.all([
      this.api.closeTask(task.id),
      this.fetchTaskComments(task.id),
    ]);
    const item = taskToStreamItem(task, displayId, typeForTask(task, sectionTypes), comments);
    item.resolvedAt = new Date().toISOString();
    item.outcome = outcome;
    return item;
  }

  async restream(
    id: ItemId,
    changes: RestreamChanges,
  ): Promise<RestreamResult> {
    const strId = String(id);
    const [{ task: oldTask, allIds }, sections] = await Promise.all([
      this.findTaskWithContext(strId),
      this.fetchSections(),
    ]);
    if (!oldTask) return { status: "not_found" };

    const oldComments = await this.fetchTaskComments(oldTask.id);
    const oldType = typeForTask(oldTask, buildSectionTypes(sections));

    // The item's content is the task's full text — title, description and any
    // comments — so a restream that leaves the content alone still carries all
    // of it into the new task.
    const oldItem = taskToStreamItem(oldTask, "", oldType, oldComments);

    // Folding pending comments into the body is itself a change, so a restream
    // that does it is never a no-op.
    const foldsComments = oldComments.some((c) => c.content.trim().length > 0);
    if (!foldsComments && isUnchangedRestream(oldItem, changes)) {
      return { status: "unchanged" };
    }

    // A Todoist task's age can't be reset, so the restarted clock is a fresh
    // task: the old one is closed and its successor carries the log forward.
    await this.api.closeTask(oldTask.id);

    const next = applyRestream(oldItem, changes, todayStr());
    const sectionId = await this.resolveSectionId(next.type, sections);
    const newTask = await this.createTask(
      {
        content: withLog(next.content, next.history),
        startDate: next.startDate,
        deadline: next.deadline,
      },
      sectionId,
    );

    // Short IDs are computed over the old and new task together so both render
    // against the same set.
    const shortIds = computeShortIds([...allIds, newTask.id]);
    const displayId = (taskId: string) => shortIds.get(taskId) ?? taskId.slice(-4);

    return {
      status: "ok",
      item: taskToStreamItem(newTask, displayId(newTask.id), next.type),
      previousType: oldType,
      replaced: displayId(oldTask.id),
    };
  }

  async update(
    id: ItemId,
    changes: UpdateChanges,
  ): Promise<UpdateResult> {
    const strId = String(id);
    const [{ task, shortIds }, sectionTypes] = await Promise.all([
      this.findTaskWithContext(strId),
      this.fetchSectionTypes(),
    ]);
    if (!task) return { status: "not_found" };

    // The deadline maps straight through (null clears). No due-date/startDate
    // touch — the decay clock is left alone.
    await this.api.updateTask(task.id, {
      deadlineDate: changes.deadline,
    } as Parameters<typeof this.api.updateTask>[1]);

    const displayId = shortIds.get(task.id) ?? task.id.slice(-4);
    const item = taskToStreamItem(task, displayId, typeForTask(task, sectionTypes));
    item.deadline = changes.deadline;
    return { status: "ok", item };
  }

  async query(filters: QueryFilters): Promise<StreamItem[]> {
    const today = todayStr();

    // In single-project mode the comment sweep is always the one project, so fetch
    // it up front in parallel with the tasks instead of tailing the pipeline.
    const [allActive, sectionTypes, projectComments] = await Promise.all([
      this.fetchAllActiveTasks(),
      this.fetchSectionTypes(),
      this.projectId
        ? this.fetchCommentsByTask([this.projectId])
        : Promise.resolve(null),
    ]);
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

    // Type filter (via section)
    if (filters.type && filters.type.length > 0) {
      const wanted = new Set<ItemType>(filters.type);
      tasks = tasks.filter((t) => wanted.has(typeForTask(t, sectionTypes)));
    }

    // Decay filters (active items only) — computed from the start date alone,
    // without building a full item.
    if (filters.decay_min !== undefined) {
      tasks = tasks.filter((t) => {
        if (t.completedAt) return false;
        return decayProgress(taskStartDate(t), today) >= filters.decay_min!;
      });
    }

    if (filters.decay_max !== undefined) {
      tasks = tasks.filter((t) => {
        if (t.completedAt) return false;
        return decayProgress(taskStartDate(t), today) < filters.decay_max!;
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

    // Multi-project fallback: sweep only the projects present in the result set.
    const commentsByTask =
      projectComments ??
      (await this.fetchCommentsByTask([...new Set(tasks.map((t) => t.projectId))]));

    const items = tasks.map((t) =>
      taskToStreamItem(
        t,
        shortIds.get(t.id) ?? t.id.slice(0, 4),
        typeForTask(t, sectionTypes),
        commentsByTask.get(t.id) ?? [],
      )
    );
    return filters.restreamed === undefined
      ? items
      : items.filter((i) => isRestreamed(i) === filters.restreamed);
  }

  // --- Private helpers ---

  /**
   * Build a Todoist task from stream params — the shared create path for `add`
   * and `restream`. The caller passes the resolved section id (null for `drift`).
   * Only sets a due date for
   * future start dates; items entering the stream today need none.
   */
  private async createTask(
    params: { content: string; startDate: string; deadline: string | null },
    sectionId: string | null,
  ): Promise<Task> {
    const isFuture = params.startDate > todayStr();
    const { content, description } = splitContent(params.content);
    return this.api.addTask({
      content,
      ...(description ? { description } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(isFuture ? { dueDate: params.startDate } : {}),
      ...(params.deadline ? { deadlineDate: params.deadline } : {}),
      ...(this.projectId ? { projectId: this.projectId } : {}),
    } as Parameters<typeof this.api.addTask>[0]);
  }

  /**
   * All sections in scope: the configured project's, or every project's when no
   * project is set (so reads across the account can still resolve a task's type).
   */
  private async fetchSections(): Promise<Section[]> {
    return collectPaginated(async (cursor) => {
      const response = await this.api.getSections({
        ...(this.projectId ? { projectId: this.projectId } : {}),
        ...(cursor ? { cursor } : {}),
      } as Parameters<typeof this.api.getSections>[0]);
      return { items: response.results, nextCursor: response.nextCursor };
    });
  }

  /** Section-id → type map for the sections in scope. */
  private async fetchSectionTypes(): Promise<Map<string, ItemType>> {
    return buildSectionTypes(await this.fetchSections());
  }

  /**
   * The section id a type belongs in, creating the section if it doesn't exist
   * yet. Returns null for `drift`, which lives in no section. Pass an already
   * fetched section list to avoid a redundant round-trip.
   */
  private async resolveSectionId(
    type: ItemType,
    sections?: Section[],
  ): Promise<string | null> {
    if (type === "drift") return null;

    const projectId = await this.resolveWriteProjectId();
    const list = sections ?? (await this.fetchSections());
    const existing = list.find(
      (s) => s.name === RUN_SECTION && s.projectId === projectId && !s.isArchived,
    );
    if (existing) return existing.id;

    const created = await this.api.addSection({ name: RUN_SECTION, projectId });
    return created.id;
  }

  /**
   * Project that new sections and tasks are written to: the configured project,
   * else the account's Inbox (looked up once and cached).
   */
  private async resolveWriteProjectId(): Promise<string> {
    if (this.projectId) return this.projectId;

    if (!this.inboxProjectId) {
      let cursor: string | null = null;
      do {
        const args: Record<string, unknown> = {};
        if (cursor) args.cursor = cursor;

        const response = await this.api.getProjects(
          args as Parameters<typeof this.api.getProjects>[0],
        );
        const inbox = response.results.find(
          (p) => "inboxProject" in p && p.inboxProject,
        );
        if (inbox) {
          this.inboxProjectId = inbox.id;
          break;
        }
        cursor = response.nextCursor;
      } while (cursor);
    }

    if (!this.inboxProjectId) {
      throw new Error(
        "Could not resolve the Todoist Inbox project for section placement.",
      );
    }
    return this.inboxProjectId;
  }

  /**
   * Fetch all active tasks, handling pagination.
   */
  private async fetchAllActiveTasks(): Promise<Task[]> {
    const allTasks = await collectPaginated(async (cursor) => {
      const response = await this.api.getTasks({
        ...(this.projectId ? { projectId: this.projectId } : {}),
        ...(cursor ? { cursor } : {}),
      } as Parameters<typeof this.api.getTasks>[0]);
      return { items: response.results, nextCursor: response.nextCursor };
    });

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
      const now = new Date();
      const since = new Date(now.getTime() - 90 * 86400000);

      const allTasks = await collectPaginated(async (cursor) => {
        const response = await this.api.getCompletedTasksByCompletionDate({
          since: since.toISOString(),
          until: now.toISOString(),
          ...(this.projectId ? { projectId: this.projectId } : {}),
          ...(cursor ? { cursor } : {}),
        } as Parameters<typeof this.api.getCompletedTasksByCompletionDate>[0]);
        return { items: response.items, nextCursor: response.nextCursor };
      });

      // Hide "uncompletable" header/note tasks ("* ...") from the stream entirely.
      return allTasks.filter((t) => !isUncompletable(t));
    } catch {
      // Completed tasks API may not be available on all plans
      return [];
    }
  }

  /**
   * All non-deleted comments on a single task, handling pagination.
   */
  private async fetchTaskComments(taskId: string): Promise<Comment[]> {
    const all = await collectPaginated(async (cursor) => {
      const response = await this.api.getComments({
        taskId,
        ...(cursor ? { cursor } : {}),
      } as Parameters<typeof this.api.getComments>[0]);
      return { items: response.results, nextCursor: response.nextCursor };
    });
    return all.filter((c) => !c.isDeleted);
  }

  /**
   * Comments for many tasks in one sweep: one paginated `getComments` per
   * distinct project (so a whole query costs a single call in the common
   * one-project setup), grouped by task id.
   */
  private async fetchCommentsByTask(
    projectIds: string[],
  ): Promise<Map<string, Comment[]>> {
    const byTask = new Map<string, Comment[]>();

    await Promise.all(
      projectIds.map(async (projectId) => {
        const comments = await collectPaginated(async (cursor) => {
          const response = await this.api.getComments({
            projectId,
            ...(cursor ? { cursor } : {}),
          } as Parameters<typeof this.api.getComments>[0]);
          return { items: response.results, nextCursor: response.nextCursor };
        });
        for (const c of comments) {
          if (c.isDeleted || !c.taskId) continue;
          const list = byTask.get(c.taskId);
          if (list) list.push(c);
          else byTask.set(c.taskId, [c]);
        }
      }),
    );

    return byTask;
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
