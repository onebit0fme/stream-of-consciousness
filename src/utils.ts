import { DECAY, StreamItem, FileStreamItem } from "./types.js";

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

export function decayDays(type: string): number {
  return DECAY[type] ?? 10;
}

export function decayProgress(item: { startDate: string; type: string }, today: string): number {
  const age = daysBetween(item.startDate, today);
  return age / decayDays(item.type);
}

export function getActiveFileItems(items: FileStreamItem[], today: string): FileStreamItem[] {
  return items.filter(
    (item) => item.resolvedAt === null && item.startDate <= today
  );
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Compute unique short ID suffixes for a set of items with string IDs.
 * Uses the tail of the ID since Todoist IDs share common prefixes.
 * Returns a map of full ID → shortest unique suffix (min 3 chars).
 */
export function computeShortIds(ids: string[]): Map<string, string> {
  const result = new Map<string, string>();
  if (ids.length === 0) return result;

  for (const id of ids) {
    let len = 3;
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
