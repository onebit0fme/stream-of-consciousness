// --- Constants ---

// Motion-states: type classifies how an item moves through attention (its
// lifecycle behavior), not what it is about. William James's "flights and
// perchings" — two perches (where attention lands and rests) crossed with two
// flights (the movement between). The decay window is part of each state's
// mechanical definition.
//   live  — directed perch: doing, a foot is already down
//   pull  — directed flight: a known action you keep avoiding, foot hovering — shortest, by design
//   muse  — free perch: no action, something you keep returning to sit with — longest, it's allowed to persist
//   drift — free flight: wondering with no landing in sight — fast, fading is the feature
export const DECAY: Record<string, number> = {
  live: 7,
  pull: 4,
  muse: 21,
  drift: 5,
};

// Ordered highest→lowest priority (P1→P4). This order is load-bearing: the
// Todoist priority mapping derives from it (priority = ITEM_TYPES.length - index).
export const ITEM_TYPES = ["live", "pull", "muse", "drift"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

// Recurrence: how many times a flight has appeared (1 = first life). A restream
// of an item that had already decayed increments it (see `nextRecurrence`). It's
// surfaced (Todoist label + rendered count) only from this threshold up — the
// first life stays unmarked, so a fresh item looks fresh.
export const RECURRENCE_DISPLAY_THRESHOLD = 2;

// --- Data Types ---

export interface StreamItem {
  id: number | string;
  displayId: string;
  type: ItemType;
  content: string;
  startDate: string;
  deadline: string | null;
  resolvedAt: string | null;
  createdAt: string;
  /** Appearance count: 1 = first life, ≥2 = restreamed from a decayed copy. */
  recurrence: number;
  restreamedFrom?: number | string | null;
}

/** Internal file-backend storage format */
export interface StreamData {
  nextId: number;
  items: FileStreamItem[];
}

/** Raw item as stored in the file backend (no displayId) */
export interface FileStreamItem {
  id: number;
  type: ItemType;
  content: string;
  startDate: string;
  deadline: string | null;
  resolvedAt: string | null;
  createdAt: string;
  /** Appearance count (optional on disk for legacy items; treated as 1 when absent). */
  recurrence?: number;
  restreamedFrom?: number | null;
}

// --- Query Filters ---

export interface QueryFilters {
  query?: string;
  type?: ItemType[];
  status: "active" | "resolved" | "all";
  decay_min?: number;
  decay_max?: number;
  deadline_within?: number;
}
