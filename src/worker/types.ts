import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  OAUTH_KV: KVNamespace;
  MCP_OBJECT: DurableObjectNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  TODOIST_CLIENT_ID: string;
  TODOIST_CLIENT_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
}

export type Props = {
  todoistUserId: string;
  /**
   * The Todoist project this *connection* is scoped to. Stored in the OAuth
   * grant props (encrypted per token), NOT in the shared per-user credential
   * record — otherwise a second connection's project selection would clobber
   * the first's, since both resolve to the same Todoist user. Connections
   * authorized before this field existed will not have it; treat absence as
   * "re-authorization required".
   */
  streamProjectId: string;
};

export const TODOIST_AUTHORIZE_URL = "https://app.todoist.com/oauth/authorize";
export const TODOIST_TOKEN_URL = "https://api.todoist.com/oauth/access_token";
export const TODOIST_SCOPE = "data:read_write";
