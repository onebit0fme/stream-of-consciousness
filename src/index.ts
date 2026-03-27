#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createBackend, StreamBackend } from "./backend.js";
import { todayStr, daysBetween, decayDays, decayProgress } from "./utils.js";

// --- MCP Server ---

const server = new McpServer({
  name: "stream-of-consciousness",
  version: "1.1.0",
});

function registerTools(backend: StreamBackend) {
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
      const today = todayStr();
      const item = await backend.add({
        content,
        type,
        startDate: startDate ?? today,
        deadline: deadline ?? null,
      });

      let text = `Added ${item.type} ${item.displayId}: "${item.content}"`;
      if (item.deadline) {
        text += ` (deadline: ${item.deadline})`;
      }
      if (item.startDate !== today) {
        text += ` (starts: ${item.startDate})`;
      }
      return { content: [{ type: "text" as const, text }] };
    }
  );

  // Tool: stream_resolve
  server.tool(
    "stream_resolve",
    "Resolve (remove) an item from the stream by ID",
    {
      id: z
        .union([z.number().int(), z.string()])
        .describe(
          "ID of the item to resolve (number for file backend, string/short prefix for Todoist)"
        ),
    },
    async ({ id }) => {
      const item = await backend.resolve(id);
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
      const age = daysBetween(item.startDate, today);
      return {
        content: [
          {
            type: "text" as const,
            text: `Resolved ${item.displayId}: "${item.content}". It lived in the stream for ${age} day${age !== 1 ? "s" : ""}.`,
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
      const items = await backend.query({
        query,
        type,
        status,
        decay_min,
        decay_max,
        deadline_within,
      });

      const today = todayStr();

      // Track which filters were applied
      const filters: string[] = [];
      if (query) filters.push(`query="${query}"`);
      if (type && type.length > 0) filters.push(`type=${type.join(",")}`);
      if (decay_min !== undefined) filters.push(`decay_min=${decay_min}`);
      if (decay_max !== undefined) filters.push(`decay_max=${decay_max}`);
      if (deadline_within !== undefined)
        filters.push(`deadline_within=${deadline_within}`);
      if (status !== "active") filters.push(`status=${status}`);

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

        let line = `[${item.displayId}] "${item.content}" (${item.type}) — age: ${age}d, decay: ${age}/${decay} (${pct}%)`;

        if (item.deadline) {
          const daysLeft = daysBetween(today, item.deadline);
          line += `, deadline: ${item.deadline} (${daysLeft} day${daysLeft !== 1 ? "s" : ""} ${daysLeft >= 0 ? "left" : "ago"})`;
        }

        if (item.restreamedFrom) {
          line += `, restreamed from ${item.restreamedFrom}`;
        }

        return line;
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `${header}\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  // Tool: stream_restream
  server.tool(
    "stream_restream",
    "Resolve an item and create a new version of it — atomic restream with lineage link",
    {
      id: z
        .union([z.number().int(), z.string()])
        .describe("ID of the active item to resolve and restream"),
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
      const result = await backend.restream(id, {
        content,
        type,
        startDate,
        deadline,
      });

      if (!result) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No active item found with ID ${id}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Restreamed ${result.old.displayId} -> ${result.new.displayId}: "${result.new.content}"`,
          },
        ],
      };
    }
  );
}

// --- Start ---

async function main() {
  const backend = await createBackend();
  registerTools(backend);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Stream MCP server failed to start:", err);
  process.exit(1);
});
