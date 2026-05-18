import { ItemType, StreamItem, QueryFilters } from "./types.js";

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
  ): Promise<{ old: StreamItem; new: StreamItem } | null>;

  query(filters: QueryFilters): Promise<StreamItem[]>;
}
