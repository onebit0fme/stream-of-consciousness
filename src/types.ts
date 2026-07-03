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

// The four motion-states, ordered by how much attention they warrant (live →
// drift). Single source for the ItemType union, the tool enums, and the docs.
// The Todoist backend carries type via named sections (Live/Pull/Muse), not
// priority — so the flag is free for the user.
export const ITEM_TYPES = ["live", "pull", "muse", "drift"] as const;
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
