import { ItemType, ItemId, Outcome, StreamItem, QueryFilters } from "./types.js";

/**
 * Outcome of a restream:
 *  - `ok`        — the item was re-encoded: `item` is how it reads now, with
 *                  the old wording at the head of its history. `replaced` is
 *                  set when the backend had to give it a new ID, and holds the
 *                  display ID it had before.
 *  - `not_found` — no active item matched the given ID.
 *  - `unchanged` — no field would have changed; the item was left alone.
 *                  Resolve it instead.
 */
export type RestreamResult =
  | { status: "ok"; item: StreamItem; previousType: ItemType; replaced?: string }
  | { status: "not_found" }
  | { status: "unchanged" };

/**
 * Outcome of an update (a light metadata touch — the deadline):
 *  - `ok`        — the item was patched in place (no decay reset, no new version).
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
}

/** Fields a restream may change; each omitted field carries over from the old item. */
export interface RestreamChanges {
  content?: string;
  type?: ItemType;
  startDate?: string;
  deadline?: string | null;
}

/** The metadata a light-touch update can patch. */
export interface UpdateChanges {
  deadline: string | null;
}

export interface StreamBackend {
  add(params: AddParams): Promise<StreamItem>;

  resolve(id: ItemId, outcome: Outcome): Promise<StreamItem | null>;

  /**
   * Re-encode an item and restart its decay clock. The item is rewritten, and
   * the wording it had moves into its history.
   */
  restream(id: ItemId, changes: RestreamChanges): Promise<RestreamResult>;

  /**
   * Patch an item's deadline without re-encoding it: no decay-clock reset. A
   * `null` clears it.
   */
  update(id: ItemId, changes: UpdateChanges): Promise<UpdateResult>;

  query(filters: QueryFilters): Promise<StreamItem[]>;
}
