import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { StreamMCP } from "./mcp-agent.js";
import { todoistHandler } from "./todoist-handler.js";

export { StreamMCP };

export default new OAuthProvider({
  apiHandler: StreamMCP.serve("/mcp") as never,
  apiRoute: "/mcp",
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: todoistHandler as never,
  tokenEndpoint: "/token",
});
