#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// --- Constants ---

const STREAM_PATH = path.join(
  os.homedir(),
  ".stream-of-consciousness"
);

const DECAY: Record<string, number> = {
  task: 10,
  thought: 7,
  idea: 14,
  output: 21,
};

const ITEM_TYPES = ["task", "thought", "idea", "output"] as const;
type ItemType = (typeof ITEM_TYPES)[number];

// --- Types ---

interface StreamItem {
  id: number;
  type: ItemType;
  content: string;
  startDate: string;
  deadline: string | null;
  resolvedAt: string | null;
  createdAt: string;
  restreamedFrom?: number | null;
}

interface StreamData {
  nextId: number;
  items: StreamItem[];
}

// --- Data Layer ---

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

function todayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 86400000;
  const dateA = new Date(a + "T00:00:00Z");
  const dateB = new Date(b + "T00:00:00Z");
  return Math.floor((dateB.getTime() - dateA.getTime()) / msPerDay);
}

function getActiveItems(items: StreamItem[], today: string): StreamItem[] {
  return items.filter(
    (item) => item.resolvedAt === null && item.startDate <= today
  );
}

function decayDays(type: string): number {
  return DECAY[type] ?? 10;
}

function decayProgress(item: StreamItem, today: string): number {
  const age = daysBetween(item.startDate, today);
  return age / decayDays(item.type);
}

// --- MCP Server ---

const server = new McpServer({
  name: "stream-of-consciousness",
  version: "1.0.0",
});

// Tool: stream_add
server.tool(
  "stream_add",
  "Add a new item to the stream",
  {
    content: z.string().describe("What to add to the stream"),
    type: z
      .enum(["task", "thought", "idea", "output"])
      .default("task")
      .describe("Item type (default: task)"),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Start date YYYY-MM-DD (default: today)"),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Hard deadline YYYY-MM-DD (optional)"),
  },
  async ({ content, type, startDate, deadline }) => {
    const data = readStream();
    const today = todayStr();
    const newItem: StreamItem = {
      id: data.nextId,
      type: type as ItemType,
      content,
      startDate: startDate ?? today,
      deadline: deadline ?? null,
      resolvedAt: null,
      createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    };
    data.items.push(newItem);
    data.nextId++;
    writeStream(data);

    let text = `Added ${type} #${newItem.id}: "${content}"`;
    if (newItem.deadline) {
      text += ` (deadline: ${newItem.deadline})`;
    }
    if (newItem.startDate !== today) {
      text += ` (starts: ${newItem.startDate})`;
    }
    return { content: [{ type: "text" as const, text }] };
  }
);

// Tool: stream_resolve
server.tool(
  "stream_resolve",
  "Resolve (remove) an item from the stream by ID",
  {
    id: z.number().int().describe("ID of the item to resolve"),
  },
  async ({ id }) => {
    const data = readStream();
    const item = data.items.find(
      (i) => i.id === id && i.resolvedAt === null
    );
    if (!item) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No active item found with ID ${id}.`,
          },
        ],
      };
    }
    const today = todayStr();
    item.resolvedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    writeStream(data);

    const age = daysBetween(item.startDate, today);
    return {
      content: [
        {
          type: "text" as const,
          text: `Resolved #${item.id}: "${item.content}". It lived in the stream for ${age} day${age !== 1 ? "s" : ""}.`,
        },
      ],
    };
  }
);

// Tool: stream_query
server.tool(
  "stream_query",
  "Query stream items with optional filters — returns matching items with computed decay/deadline fields",
  {
    query: z
      .string()
      .optional()
      .describe("Substring search on content (case-insensitive)"),
    type: z
      .array(z.enum(["task", "thought", "idea", "output"]))
      .optional()
      .describe("Filter by item type(s)"),
    status: z
      .enum(["active", "resolved", "all"])
      .default("active")
      .describe("Which items to include (default: active)"),
    decay_min: z
      .number()
      .optional()
      .describe("Min decay progress inclusive (e.g. 0.5, 1.0)"),
    decay_max: z
      .number()
      .optional()
      .describe("Max decay progress exclusive (e.g. 1.0)"),
    deadline_within: z
      .number()
      .optional()
      .describe("Items with deadline within N days"),
  },
  async ({ query, type, status, decay_min, decay_max, deadline_within }) => {
    const data = readStream();
    const today = todayStr();

    // Start with items based on status filter
    let items: StreamItem[];
    if (status === "active") {
      items = getActiveItems(data.items, today);
    } else if (status === "resolved") {
      items = data.items.filter((i) => i.resolvedAt !== null);
    } else {
      items = [...data.items];
    }

    // Track which filters were applied
    const filters: string[] = [];

    // Substring search
    if (query) {
      const lower = query.toLowerCase();
      items = items.filter((i) => i.content.toLowerCase().includes(lower));
      filters.push(`query="${query}"`);
    }

    // Type filter
    if (type && type.length > 0) {
      items = items.filter((i) => type.includes(i.type));
      filters.push(`type=${type.join(",")}`);
    }

    // Decay progress filters (only meaningful for active items with a start date)
    if (decay_min !== undefined) {
      items = items.filter((i) => i.resolvedAt === null && decayProgress(i, today) >= decay_min);
      filters.push(`decay_min=${decay_min}`);
    }
    if (decay_max !== undefined) {
      items = items.filter((i) => i.resolvedAt === null && decayProgress(i, today) < decay_max);
      filters.push(`decay_max=${decay_max}`);
    }

    // Deadline within N days
    if (deadline_within !== undefined) {
      items = items.filter((i) => {
        if (!i.deadline) return false;
        const daysToDeadline = daysBetween(today, i.deadline);
        return daysToDeadline <= deadline_within;
      });
      filters.push(`deadline_within=${deadline_within}`);
    }

    if (status !== "active") {
      filters.push(`status=${status}`);
    }

    // Format output
    const filterDesc = filters.length > 0 ? filters.join(", ") : "none";
    const header = `Found ${items.length} item${items.length !== 1 ? "s" : ""} (filters applied: ${filterDesc})`;

    if (items.length === 0) {
      return { content: [{ type: "text" as const, text: header }] };
    }

    const lines = items.map((item) => {
      const age = daysBetween(item.startDate, today);
      const decay = decayDays(item.type);
      const progress = decayProgress(item, today);
      const pct = Math.round(progress * 100);

      let line = `[#${item.id}] "${item.content}" (${item.type}) — age: ${age}d, decay: ${age}/${decay} (${pct}%)`;

      if (item.deadline) {
        const daysLeft = daysBetween(today, item.deadline);
        line += `, deadline: ${item.deadline} (${daysLeft} day${daysLeft !== 1 ? "s" : ""} ${daysLeft >= 0 ? "left" : "ago"})`;
      }

      if (item.restreamedFrom) {
        line += `, restreamed from #${item.restreamedFrom}`;
      }

      return line;
    });

    return {
      content: [{ type: "text" as const, text: `${header}\n${lines.join("\n")}` }],
    };
  }
);

// Tool: stream_restream
server.tool(
  "stream_restream",
  "Resolve an item and create a new version of it — atomic restream with lineage link",
  {
    id: z.number().int().describe("ID of the active item to resolve and restream"),
    content: z
      .string()
      .optional()
      .describe("New content (defaults to old item's content)"),
    type: z
      .enum(["task", "thought", "idea", "output"])
      .optional()
      .describe("New type (defaults to old item's type)"),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("New start date YYYY-MM-DD (defaults to today)"),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("New deadline YYYY-MM-DD (defaults to old item's deadline)"),
  },
  async ({ id, content, type, startDate, deadline }) => {
    const data = readStream();
    const oldItem = data.items.find(
      (i) => i.id === id && i.resolvedAt === null
    );
    if (!oldItem) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No active item found with ID ${id}.`,
          },
        ],
      };
    }

    const today = todayStr();

    // Resolve the old item
    oldItem.resolvedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

    // Create new item with lineage
    const newItem: StreamItem = {
      id: data.nextId,
      type: (type as ItemType) ?? oldItem.type,
      content: content ?? oldItem.content,
      startDate: startDate ?? today,
      deadline: deadline !== undefined ? deadline : oldItem.deadline,
      resolvedAt: null,
      createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      restreamedFrom: id,
    };
    data.items.push(newItem);
    data.nextId++;

    writeStream(data);

    return {
      content: [
        {
          type: "text" as const,
          text: `Restreamed #${id} -> #${newItem.id}: "${newItem.content}"`,
        },
      ],
    };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Stream MCP server failed to start:", err);
  process.exit(1);
});
