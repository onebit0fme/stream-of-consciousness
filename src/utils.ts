import {
  DECAY,
  AUTO_GATE_RECURRENCE,
  RECURRENCE_DISPLAY_THRESHOLD,
  ItemType,
  StreamItem,
  FileStreamItem,
} from "./types.js";

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
  return DECAY[type] ?? 7;
}

export function decayProgress(item: { startDate: string; type: string }, today: string): number {
  const age = daysBetween(item.startDate, today);
  return age / decayDays(item.type);
}

/**
 * Recurrence count for the new copy when restreaming. It climbs only when the
 * old copy had actually decayed (a returning ghost), not on a mid-life
 * refinement — so chatty restreams don't inflate the count.
 */
export function nextRecurrence(oldRecurrence: number, oldProgress: number): number {
  return oldProgress >= 1 ? oldRecurrence + 1 : oldRecurrence;
}

/**
 * The type a restreamed item should take: the caller's explicit type wins;
 * otherwise a sufficiently-recurred ghost auto-routes to `gate`, else it keeps
 * the old type.
 */
export function restreamType(
  explicit: ItemType | undefined,
  oldType: ItemType,
  recurrence: number,
): ItemType {
  if (explicit) return explicit;
  return recurrence >= AUTO_GATE_RECURRENCE ? "gate" : oldType;
}

/**
 * Display suffix for an item's recurrence: ` ↻N` once it has recurred, empty
 * for a first-life item. The leading space lets callers append it inline.
 */
export function formatRecurrence(recurrence: number): string {
  return recurrence >= RECURRENCE_DISPLAY_THRESHOLD ? ` ↻${recurrence}` : "";
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
