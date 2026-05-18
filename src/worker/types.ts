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
};

export const TODOIST_AUTHORIZE_URL = "https://app.todoist.com/oauth/authorize";
export const TODOIST_TOKEN_URL = "https://api.todoist.com/oauth/access_token";
export const TODOIST_SCOPE = "data:read_write";
