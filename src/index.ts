#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createBackend } from "./backend-factory.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "stream-of-consciousness",
  version: "1.4.0",
});

async function main() {
  const backend = await createBackend();
  registerTools(server, backend);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Stream MCP server failed to start:", err);
  process.exit(1);
});
