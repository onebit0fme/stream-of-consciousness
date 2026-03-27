// --- Constants ---

export const DECAY: Record<string, number> = {
  task: 10,
  thought: 7,
  idea: 14,
  output: 21,
};

export const ITEM_TYPES = ["task", "thought", "idea", "output"] as const;
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
