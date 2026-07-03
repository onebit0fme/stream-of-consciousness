import { ItemType, StreamItem, QueryFilters } from "./types.js";

/**
 * Outcome of a restream:
 *  - `ok`        — the old item was resolved and a new version created.
 *  - `not_found` — no active item matched the given ID.
 *  - `unchanged` — the restream would have recreated the item as-is (no field
 *                  changed); nothing was resolved. Resolve it instead.
 */
export type RestreamResult =
  | { status: "ok"; old: StreamItem; new: StreamItem }
  | { status: "not_found" }
  | { status: "unchanged" };

export interface StreamBackend {
  add(params: {
    content: string;
    type: ItemType;
    startDate: string;
    deadline: string | null;
  }): Promise<StreamItem>;

  resolve(id: number | string): Promise<StreamItem | null>;

  restream(
    id: number | string,
    changes: {
      content?: string;
      type?: ItemType;
      startDate?: string;
      deadline?: string | null;
    },
  ): Promise<RestreamResult>;

  query(filters: QueryFilters): Promise<StreamItem[]>;
}
