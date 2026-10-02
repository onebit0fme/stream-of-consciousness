import type { RestreamChanges } from "./backend.js";
import { DECAY_DAYS, FileStreamItem, PastWording, StreamItem } from "./types.js";

export function todayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const msPerDay = 86400000;
  const dateA = new Date(a + "T00:00:00Z");
  const dateB = new Date(b + "T00:00:00Z");
  return Math.floor((dateB.getTime() - dateA.getTime()) / msPerDay);
}

export function decayProgress(startDate: string, today: string): number {
  return daysBetween(startDate, today) / DECAY_DAYS;
}

/**
 * A restream is unchanged (a no-op) when nothing the caller can set actually
 * differs from the old item: content, type, deadline, and startDate are each
 * either omitted or equal to the old value. The automatic startDate refresh to
 * "today" alone doesn't count — an as-is restream just churns the item, so
 * callers should resolve it instead.
 */
export function isUnchangedRestream(
  old: { content: string; type: string; deadline: string | null; startDate: string },
  changes: { content?: string; type?: string; deadline?: string | null; startDate?: string },
): boolean {
  return (
    (changes.content === undefined || changes.content === old.content) &&
    (changes.type === undefined || changes.type === old.type) &&
    (changes.deadline === undefined || changes.deadline === old.deadline) &&
    (changes.startDate === undefined || changes.startDate === old.startDate)
  );
}

export function getActiveFileItems(items: FileStreamItem[], today: string): FileStreamItem[] {
  return items.filter(
    (item) => item.resolvedAt === null && item.startDate <= today
  );
}

export function isRestreamed(item: { history: PastWording[] }): boolean {
  return item.history.length > 0;
}

/**
 * The name a restreamed item goes by: a run that has come round again is
 * a `pull` (you keep circling the action), a drift that has is a `muse` (you
 * keep returning to the thought). Neither is a type — both are read off the
 * item's history.
 */
export function lineageLabel(item: {
  type: string;
  history: PastWording[];
}): "pull" | "muse" | null {
  if (!isRestreamed(item)) return null;
  return item.type === "run" ? "pull" : "muse";
}

/**
 * An item's history after a restream on `date`: the first line of the wording
 * being replaced goes to the head.
 */
export function withPastWording(
  history: PastWording[],
  content: string,
  date: string,
): PastWording[] {
  return [{ date, content: content.split("\n", 1)[0] }, ...history];
}

/**
 * The fields of an item after a restream on `today`: each change applied, the
 * decay clock restarted, and the wording being replaced added to its history.
 */
export function applyRestream(
  old: Pick<StreamItem, "type" | "content" | "deadline" | "history">,
  changes: RestreamChanges,
  today: string,
): Pick<StreamItem, "type" | "content" | "deadline" | "startDate" | "history"> {
  return {
    type: changes.type ?? old.type,
    content: changes.content ?? old.content,
    deadline: changes.deadline !== undefined ? changes.deadline : old.deadline,
    startDate: changes.startDate ?? today,
    history: withPastWording(old.history, old.content, today),
  };
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Compute unique short ID suffixes for a set of items with string IDs.
 * Uses the tail of the ID since Todoist IDs share common prefixes.
 * Returns a map of full ID → shortest unique suffix (min 1 char).
 */
export function computeShortIds(ids: string[]): Map<string, string> {
  const result = new Map<string, string>();
  if (ids.length === 0) return result;

  for (const id of ids) {
    let len = 1;
    while (len <= id.length) {
      const suffix = id.slice(-len);
      const collision = ids.some(
        (other) => other !== id && other.slice(-len) === suffix
      );
      if (!collision) {
        result.set(id, suffix);
        break;
      }
      len++;
    }
    if (!result.has(id)) {
      result.set(id, id);
    }
  }

  return result;
}

/**
 * Resolve a short suffix or full ID against a list of full IDs.
 * Returns the matching full ID or null if no match / ambiguous.
 */
export function resolveShortId(input: string, ids: string[]): string | null {
  // Exact match first
  if (ids.includes(input)) return input;

  // Suffix match
  const matches = ids.filter((id) => id.endsWith(input));
  if (matches.length === 1) return matches[0];

  return null; // No match or ambiguous
}
