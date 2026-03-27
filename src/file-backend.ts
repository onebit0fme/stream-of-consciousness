import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { StreamBackend } from "./backend.js";
import {
  ItemType,
  StreamItem,
  StreamData,
  FileStreamItem,
  QueryFilters,
} from "./types.js";
import {
  todayStr,
  daysBetween,
  decayDays,
  decayProgress,
  getActiveFileItems,
  nowIso,
} from "./utils.js";

const STREAM_PATH = path.join(os.homedir(), ".stream-of-consciousness");

function readStream(): StreamData {
  if (!fs.existsSync(STREAM_PATH)) {
    const initial: StreamData = { nextId: 1, items: [] };
    writeStream(initial);
    return initial;
  }
  const raw = fs.readFileSync(STREAM_PATH, "utf-8");
  return JSON.parse(raw) as StreamData;
}

function writeStream(data: StreamData): void {
  const dir = path.dirname(STREAM_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = STREAM_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, STREAM_PATH);
}

function toStreamItem(item: FileStreamItem): StreamItem {
  return {
    ...item,
    displayId: `#${item.id}`,
    restreamedFrom: item.restreamedFrom ?? null,
  };
}

export class FileBackend implements StreamBackend {
  async add(params: {
    content: string;
    type: ItemType;
    startDate: string;
    deadline: string | null;
  }): Promise<StreamItem> {
    const data = readStream();
    const today = todayStr();
    const newItem: FileStreamItem = {
      id: data.nextId,
      type: params.type,
      content: params.content,
      startDate: params.startDate || today,
      deadline: params.deadline,
      resolvedAt: null,
      createdAt: nowIso(),
    };
    data.items.push(newItem);
    data.nextId++;
    writeStream(data);
    return toStreamItem(newItem);
  }

  async resolve(id: number | string): Promise<StreamItem | null> {
    const numId = typeof id === "string" ? parseInt(id, 10) : id;
    if (isNaN(numId)) return null;

    const data = readStream();
    const item = data.items.find(
      (i) => i.id === numId && i.resolvedAt === null
    );
    if (!item) return null;

    item.resolvedAt = nowIso();
    writeStream(data);
    return toStreamItem(item);
  }

  async restream(
    id: number | string,
    changes: {
      content?: string;
      type?: ItemType;
      startDate?: string;
      deadline?: string | null;
    },
  ): Promise<{ old: StreamItem; new: StreamItem } | null> {
    const numId = typeof id === "string" ? parseInt(id, 10) : id;
    if (isNaN(numId)) return null;

    const data = readStream();
    const oldItem = data.items.find(
      (i) => i.id === numId && i.resolvedAt === null
    );
    if (!oldItem) return null;

    const today = todayStr();
    oldItem.resolvedAt = nowIso();

    const newItem: FileStreamItem = {
      id: data.nextId,
      type: changes.type ?? oldItem.type,
      content: changes.content ?? oldItem.content,
      startDate: changes.startDate ?? today,
      deadline:
        changes.deadline !== undefined ? changes.deadline : oldItem.deadline,
      resolvedAt: null,
      createdAt: nowIso(),
      restreamedFrom: numId,
    };
    data.items.push(newItem);
    data.nextId++;
    writeStream(data);

    return { old: toStreamItem(oldItem), new: toStreamItem(newItem) };
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

    if (filters.decay_min !== undefined) {
      items = items.filter(
        (i) =>
          i.resolvedAt === null &&
          decayProgress(i, today) >= filters.decay_min!
      );
    }

    if (filters.decay_max !== undefined) {
      items = items.filter(
        (i) =>
          i.resolvedAt === null &&
          decayProgress(i, today) < filters.decay_max!
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
