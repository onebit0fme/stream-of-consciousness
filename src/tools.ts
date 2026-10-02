import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { StreamBackend } from "./backend.js";
import { todayStr, daysBetween, decayProgress, lineageLabel } from "./utils.js";
import { DECAY_DAYS, ITEM_TYPES, ItemId, OUTCOMES } from "./types.js";

const itemId = z.union([z.number().int(), z.string()]);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

function notFound(id: ItemId) {
  return text(`No active item found with ID ${id}.`);
}

function days(count: number): string {
  return `${count} day${count !== 1 ? "s" : ""}`;
}

export function registerTools(server: McpServer, backend: StreamBackend): void {
  server.tool(
    "stream_add",
    "Add a new item to the stream",
    {
      content: z.string().describe("What to add to the stream"),
      type: z
        .enum(ITEM_TYPES)
        .default("run")
        .describe(
          "What attention is doing with the item: " +
            "run=there is an action and you are on it; " +
            "drift=wondering, no action in sight (fading is fine). " +
            "Default: run."
        ),
      startDate: dateStr.optional().describe("Start date YYYY-MM-DD (default: today)"),
      deadline: dateStr.optional().describe("Hard deadline YYYY-MM-DD (optional)"),
    },
    async ({ content, type, startDate, deadline }) => {
      const today = todayStr();
      const item = await backend.add({
        content,
        type,
        startDate: startDate ?? today,
        deadline: deadline ?? null,
      });

      let out = `Added ${item.type} ${item.displayId}: "${item.content}"`;
      if (item.deadline) out += ` (deadline: ${item.deadline})`;
      if (item.startDate !== today) out += ` (starts: ${item.startDate})`;
      return text(out);
    }
  );

  server.tool(
    "stream_resolve",
    "Take an item out of the stream by ID",
    {
      id: itemId.describe(
        "ID of the item to resolve (number for file backend, string/short prefix for Todoist)"
      ),
      outcome: z
        .enum(OUTCOMES)
        .default("resolved")
        .describe("How it left: resolved=done; escaped=dropped. Default: resolved."),
    },
    async ({ id, outcome }) => {
      const item = await backend.resolve(id, outcome);
      if (!item) return notFound(id);

      // startDate moves with every restream, so a life is counted from creation.
      const age = daysBetween(item.createdAt.slice(0, 10), todayStr());
      const verb = outcome === "escaped" ? "Escaped" : "Resolved";
      return text(
        `${verb} ${item.displayId}: "${item.content}". It lived in the stream for ${days(age)}.`
      );
    }
  );

  server.tool(
    "stream_query",
    "Query stream items with optional filters — returns matching items with computed decay/deadline fields",
    {
      query: z
        .string()
        .optional()
        .describe("Substring search on content (case-insensitive)"),
      type: z
        .array(z.enum(ITEM_TYPES))
        .optional()
        .describe("Filter by type(s): run, drift"),
      status: z
        .enum(["active", "resolved", "all"])
        .default("active")
        .describe("Which items to include (default: active)"),
      restreamed: z
        .boolean()
        .optional()
        .describe(
          "true = only items that have been restreamed (with type run these are the pulls, with type drift the muses); false = only items still in their first wording"
        ),
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
    async (filters) => {
      const items = await backend.query(filters);
      const today = todayStr();

      const applied = Object.entries(filters)
        .filter(([key, value]) => value !== undefined && !(key === "status" && value === "active"))
        .map(([key, value]) => (key === "query" ? `query="${value}"` : `${key}=${value}`));
      const header = `Found ${items.length} item${items.length !== 1 ? "s" : ""} (filters applied: ${applied.length > 0 ? applied.join(", ") : "none"})`;
      if (items.length === 0) return text(header);

      const lines = items.map((item) => {
        const age = daysBetween(item.startDate, today);
        const pct = Math.round(decayProgress(item.startDate, today) * 100);
        const lineage = lineageLabel(item);
        const type = lineage ? `${item.type}, ${lineage}` : item.type;

        let line = `[${item.displayId}] "${item.content}" (${type}) — age: ${age}d, decay: ${age}/${DECAY_DAYS} (${pct}%)`;

        if (item.deadline) {
          const daysLeft = daysBetween(today, item.deadline);
          line += `, deadline: ${item.deadline} (${days(daysLeft)} ${daysLeft >= 0 ? "left" : "ago"})`;
        }

        if (item.history.length > 0) {
          const last = item.history[0];
          line += `, restreamed ${item.history.length}x, before ${last.date}: "${last.content}"`;
        }
        if (item.outcome) line += `, ${item.outcome}`;

        return line;
      });

      return text(`${header}\n${lines.join("\n")}`);
    }
  );

  server.tool(
    "stream_restream",
    "Re-encode an item and restart its decay clock. The item is rewritten, and the wording it had moves into its history. Requires at least one changed field (content, type, startDate, or deadline); an unchanged restream is rejected — resolve the item instead.",
    {
      id: itemId.describe("ID of the active item to restream"),
      content: z
        .string()
        .optional()
        .describe("New content (defaults to old item's content)"),
      type: z
        .enum(ITEM_TYPES)
        .optional()
        .describe(
          "New type (defaults to the old item's) — a run may become a drift and a drift a run."
        ),
      startDate: dateStr.optional().describe("New start date YYYY-MM-DD (defaults to today)"),
      deadline: dateStr
        .nullable()
        .optional()
        .describe("New deadline YYYY-MM-DD; pass null to clear an existing deadline; omit to keep the current one"),
    },
    async ({ id, content, type, startDate, deadline }) => {
      const result = await backend.restream(id, { content, type, startDate, deadline });

      if (result.status === "not_found") return notFound(id);
      if (result.status === "unchanged") {
        return text(
          `Nothing changed, so ${id} was left as-is — a restream needs a new content, type, start date, or deadline. If it's done, resolve it instead.`
        );
      }

      const { item, previousType, replaced } = result;
      let out = `Restreamed ${replaced ? `${replaced} -> ` : ""}${item.displayId}: "${item.content}"`;
      if (item.type !== previousType) out += `, now ${item.type}`;
      return text(`${out}. Its decay clock starts over.`);
    }
  );

  server.tool(
    "stream_update",
    "Update an item's deadline in place — a light touch that does NOT reset the decay clock. Reach for stream_restream instead when the item's content or type genuinely changed (a re-encoding).",
    {
      id: itemId.describe("ID of the active item to update"),
      deadline: dateStr
        .nullable()
        .describe("New deadline YYYY-MM-DD; pass null to clear."),
    },
    async ({ id, deadline }) => {
      const result = await backend.update(id, { deadline });
      if (result.status === "not_found") return notFound(id);

      const { item } = result;
      return text(
        `Updated ${item.displayId}: ${item.deadline ? `deadline ${item.deadline}` : "deadline cleared"} (decay untouched).`
      );
    }
  );
}
