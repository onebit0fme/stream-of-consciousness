// --- Constants ---

// Type classifies what attention is doing with an item, not what it is about:
//   run   — directed: there is an action and you are on it
//   drift — free: wondering, no action in sight
export const ITEM_TYPES = ["run", "drift"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

// Decay window in days. An item's clock starts when it enters the stream and
// restarts only by restreaming it.
export const DECAY_DAYS = 7;

// How an item leaves the stream: `resolved` (it is done) or `escaped` (dropped).
export const OUTCOMES = ["resolved", "escaped"] as const;
export type Outcome = (typeof OUTCOMES)[number];

// --- Data Types ---

export type ItemId = number | string;

/** A wording an item had before it was restreamed: its first line, and the date it was replaced. */
export interface PastWording {
  date: string;
  content: string;
}

export interface StreamItem {
  id: ItemId;
  displayId: string;
  type: ItemType;
  content: string;
  /** The date the decay clock starts from. */
  startDate: string;
  deadline: string | null;
  /** The item's earlier wordings, most recent first — one per restream. */
  history: PastWording[];
  resolvedAt: string | null;
  outcome: Outcome | null;
  createdAt: string;
}

/** Internal file-backend storage format */
export interface StreamData {
  nextId: number;
  items: FileStreamItem[];
}

/** Raw item as stored in the file backend (no displayId) */
export interface FileStreamItem extends Omit<StreamItem, "displayId" | "id"> {
  id: number;
}

// --- Query Filters ---

export interface QueryFilters {
  query?: string;
  type?: ItemType[];
  status: "active" | "resolved" | "all";
  /** Only items that have (true) or have not (false) been restreamed. */
  restreamed?: boolean;
  decay_min?: number;
  decay_max?: number;
  deadline_within?: number;
}
