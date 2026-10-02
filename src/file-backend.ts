import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  StreamBackend,
  RestreamResult,
  UpdateResult,
  AddParams,
  RestreamChanges,
  UpdateChanges,
} from "./backend.js";
import {
  ItemId,
  ItemType,
  Outcome,
  StreamItem,
  StreamData,
  FileStreamItem,
  QueryFilters,
} from "./types.js";
import {
  todayStr,
  daysBetween,
  decayProgress,
  getActiveFileItems,
  nowIso,
  isUnchangedRestream,
  isRestreamed,
  applyRestream,
} from "./utils.js";

function streamPath(): string {
  return process.env.STREAM_FILE ?? path.join(os.homedir(), ".stream-of-consciousness");
}

// Type names a stream file may also carry, and the type each reads as.
const TYPE_ALIASES: Record<string, ItemType> = { live: "run", pull: "run", muse: "drift" };

/** An item as it may appear in a stream file: any type name, optional fields possibly absent. */
type StoredItem = Pick<FileStreamItem, "id" | "content" | "startDate" | "createdAt"> &
  Partial<Pick<FileStreamItem, "deadline" | "history" | "resolvedAt" | "outcome">> & { type: string };

/** A stored item in the current shape: type aliases resolved, absent fields defaulted, unknown ones dropped. */
export function normalizeFileItem(raw: StoredItem): FileStreamItem {
  return {
    id: raw.id,
    type: TYPE_ALIASES[raw.type] ?? (raw.type as ItemType),
    content: raw.content,
    startDate: raw.startDate,
    deadline: raw.deadline ?? null,
    history: raw.history ?? [],
    resolvedAt: raw.resolvedAt ?? null,
    outcome: raw.outcome ?? (raw.resolvedAt ? "resolved" : null),
    createdAt: raw.createdAt,
  };
}

function readStream(): StreamData {
  const file = streamPath();
  if (!fs.existsSync(file)) {
    const initial: StreamData = { nextId: 1, items: [] };
    writeStream(initial);
    return initial;
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as {
    nextId: number;
    items: StoredItem[];
  };
  return { nextId: raw.nextId, items: raw.items.map(normalizeFileItem) };
}

function writeStream(data: StreamData): void {
  const file = streamPath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, file);
}

function toStreamItem(item: FileStreamItem): StreamItem {
  return { ...item, displayId: `#${item.id}` };
}

/** The active item with this ID, given as a number or in the `#12` display form. */
function findActive(data: StreamData, id: ItemId): FileStreamItem | undefined {
  const numId = typeof id === "string" ? parseInt(id.replace(/^#/, ""), 10) : id;
  return data.items.find((i) => i.id === numId && i.resolvedAt === null);
}

export class FileBackend implements StreamBackend {
  async add(params: AddParams): Promise<StreamItem> {
    const data = readStream();
    const newItem: FileStreamItem = {
      id: data.nextId,
      type: params.type,
      content: params.content,
      startDate: params.startDate,
      deadline: params.deadline,
      history: [],
      resolvedAt: null,
      outcome: null,
      createdAt: nowIso(),
    };
    data.items.push(newItem);
    data.nextId++;
    writeStream(data);
    return toStreamItem(newItem);
  }

  async resolve(id: ItemId, outcome: Outcome): Promise<StreamItem | null> {
    const data = readStream();
    const item = findActive(data, id);
    if (!item) return null;

    item.resolvedAt = nowIso();
    item.outcome = outcome;
    writeStream(data);
    return toStreamItem(item);
  }

  async restream(id: ItemId, changes: RestreamChanges): Promise<RestreamResult> {
    const data = readStream();
    const item = findActive(data, id);
    if (!item) return { status: "not_found" };

    if (isUnchangedRestream(item, changes)) return { status: "unchanged" };

    const previousType = item.type;
    Object.assign(item, applyRestream(item, changes, todayStr()));
    writeStream(data);

    return { status: "ok", item: toStreamItem(item), previousType };
  }

  async update(id: ItemId, changes: UpdateChanges): Promise<UpdateResult> {
    const data = readStream();
    const item = findActive(data, id);
    if (!item) return { status: "not_found" };

    // A metadata patch: no startDate change, so the decay clock is untouched.
    item.deadline = changes.deadline;
    writeStream(data);

    return { status: "ok", item: toStreamItem(item) };
  }

  async query(filters: QueryFilters): Promise<StreamItem[]> {
    const data = readStream();
    const today = todayStr();

    let items: FileStreamItem[];
    if (filters.status === "active") {
      items = getActiveFileItems(data.items, today);
    } else if (filters.status === "resolved") {
      items = data.items.filter((i) => i.resolvedAt !== null);
    } else {
      items = [...data.items];
    }

    if (filters.query) {
      const lower = filters.query.toLowerCase();
      items = items.filter((i) =>
        i.content.toLowerCase().includes(lower)
      );
    }

    if (filters.type && filters.type.length > 0) {
      items = items.filter((i) => filters.type!.includes(i.type));
    }

    if (filters.restreamed !== undefined) {
      items = items.filter((i) => isRestreamed(i) === filters.restreamed);
    }

    if (filters.decay_min !== undefined) {
      items = items.filter(
        (i) =>
          i.resolvedAt === null &&
          decayProgress(i.startDate, today) >= filters.decay_min!
      );
    }

    if (filters.decay_max !== undefined) {
      items = items.filter(
        (i) =>
          i.resolvedAt === null &&
          decayProgress(i.startDate, today) < filters.decay_max!
      );
    }

    if (filters.deadline_within !== undefined) {
      items = items.filter((i) => {
        if (!i.deadline) return false;
        const daysLeft = daysBetween(today, i.deadline);
        return daysLeft <= filters.deadline_within!;
      });
    }

    return items.map(toStreamItem);
  }
}
