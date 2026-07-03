import { ItemType, Hook, StreamItem, QueryFilters } from "./types.js";

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

/**
 * Outcome of an update (a light metadata touch — hook and/or deadline):
 *  - `ok`        — the item was patched in place (no decay reset, no lineage).
 *  - `not_found` — no active item matched the given ID.
 */
export type UpdateResult =
  | { status: "ok"; item: StreamItem }
  | { status: "not_found" };

/** Fields for a new item (`stream_add`). */
export interface AddParams {
  content: string;
  type: ItemType;
  startDate: string;
  deadline: string | null;
  hook: Hook | null;
}

/** Fields a restream may change; each omitted field carries over from the old item. */
export interface RestreamChanges {
  content?: string;
  type?: ItemType;
  startDate?: string;
  deadline?: string | null;
  hook?: Hook | null;
}

/** The metadata a light-touch update can patch — a subset of a restream's changes. */
export type UpdateChanges = Pick<RestreamChanges, "hook" | "deadline">;

export interface StreamBackend {
  add(params: AddParams): Promise<StreamItem>;

  resolve(id: number | string): Promise<StreamItem | null>;

  restream(id: number | string, changes: RestreamChanges): Promise<RestreamResult>;

  /**
   * Patch an item's hook and/or deadline without re-encoding it: no decay-clock
   * reset, no lineage. This is the light-touch counterpart to {@link restream},
   * which is reserved for genuine content/type re-encodings. Only the fields
   * present in `changes` are written (a `null` clears; an omitted field is left
   * as-is).
   */
  update(id: number | string, changes: UpdateChanges): Promise<UpdateResult>;

  query(filters: QueryFilters): Promise<StreamItem[]>;
}
