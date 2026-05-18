import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../tools.js";
import { RefreshingTodoistBackend } from "./refreshing-backend.js";
import type { Env, Props } from "./types.js";

export class StreamMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: "stream-of-consciousness",
    version: "1.3.0",
  });

  async init() {
    const backend = await RefreshingTodoistBackend.create(this.env, this.props!.todoistUserId);
    registerTools(this.server, backend);
  }
}
