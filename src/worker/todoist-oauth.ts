import { TODOIST_AUTHORIZE_URL, TODOIST_TOKEN_URL, TODOIST_SCOPE } from "./types.js";

export interface TodoistTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export function buildTodoistAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const url = new URL(TODOIST_AUTHORIZE_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("scope", params.scope ?? TODOIST_SCOPE);
  url.searchParams.set("state", params.state);
  url.searchParams.set("redirect_uri", params.redirectUri);
  return url.href;
}

async function postToTokenEndpoint(
  label: string,
  body: Record<string, string>,
): Promise<TodoistTokenResponse> {
  const resp = await fetch(TODOIST_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!resp.ok) {
    throw new Error(`Todoist ${label} failed (${resp.status}): ${await resp.text()}`);
  }
  return (await resp.json()) as TodoistTokenResponse;
}

export function exchangeTodoistCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<TodoistTokenResponse> {
  return postToTokenEndpoint("token exchange", {
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });
}

export function refreshTodoistToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TodoistTokenResponse> {
  return postToTokenEndpoint("token refresh", {
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
    grant_type: "refresh_token",
  });
}

export function computeTokenExpiry(expiresIn?: number): number | null {
  if (typeof expiresIn !== "number") return null;
  return Date.now() + (expiresIn - 60) * 1000; // 60s safety margin
}
