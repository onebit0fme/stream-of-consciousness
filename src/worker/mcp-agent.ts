import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../tools.js";
import { RefreshingTodoistBackend } from "./refreshing-backend.js";
import type { Env, Props } from "./types.js";

export class StreamMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: "stream-of-consciousness",
    version: "1.4.0",
  });

  async init() {
    const { todoistUserId, streamProjectId } = this.props!;
    // Grants authorized before per-connection project scoping was added carry no
    // streamProjectId. Falling back to the shared creds record is exactly the bug
    // this guards against (one connection's project leaking into another), so
    // require re-authorization instead.
    if (!streamProjectId) {
      throw new Error(
        "This connection predates per-project scoping. Please reconnect (remove and re-add the connector) to choose its project.",
      );
    }
    const backend = await RefreshingTodoistBackend.create(this.env, todoistUserId, streamProjectId);
    registerTools(this.server, backend);
  }
}
