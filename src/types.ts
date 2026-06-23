// --- Constants ---

// Motion-states: type classifies how an item moves through attention (its
// lifecycle behavior), not what it is about. The decay window is part of each
// state's mechanical definition.
//   live  — doing (a perch you're standing on)
//   pull  — wanting (a flight; momentum toward, no foot down) — shortest, by design
//   gate  — deciding (a flight; the work is an unmade decision) — longest, decisions ripen
//   drift — wondering (a flight; novelty for its own sake) — fast, fading is the feature
export const DECAY: Record<string, number> = {
  live: 7,
  pull: 4,
  gate: 14,
  drift: 5,
};

// Ordered highest→lowest priority (P1→P4). This order is load-bearing: the
// Todoist priority mapping derives from it (priority = ITEM_TYPES.length - index).
export const ITEM_TYPES = ["live", "pull", "gate", "drift"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

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
