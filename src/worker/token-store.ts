import type { Env } from "./types.js";

export interface StoredTodoistCredentials {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  streamProjectId: string | null;
}

function key(userId: string): string {
  return `todoist:user:${userId}`;
}

export async function readCredentials(env: Env, userId: string): Promise<StoredTodoistCredentials | null> {
  const raw = await env.OAUTH_KV.get(key(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTodoistCredentials;
  } catch {
    return null;
  }
}

export async function writeCredentials(
  env: Env,
  userId: string,
  creds: StoredTodoistCredentials,
): Promise<void> {
  await env.OAUTH_KV.put(key(userId), JSON.stringify(creds));
}

export async function patchCredentials(
  env: Env,
  userId: string,
  patch: Partial<StoredTodoistCredentials>,
): Promise<StoredTodoistCredentials> {
  const existing = (await readCredentials(env, userId)) ?? {
    accessToken: "",
    refreshToken: null,
    expiresAt: null,
    streamProjectId: null,
  };
  const merged: StoredTodoistCredentials = { ...existing, ...patch };
  await writeCredentials(env, userId, merged);
  return merged;
}

/**
 * Short-lived state held between Todoist code exchange and the user
 * picking a project. Lives long enough for the user to read the picker
 * and submit, but no longer.
 */
export interface PendingAuth {
  oauthReqInfo: import("@cloudflare/workers-oauth-provider").AuthRequest;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  userId: string;
  userName: string;
  projectIds: string[]; // whitelist for picker submission
}

function pendingKey(id: string): string {
  return `pending:auth:${id}`;
}

export async function writePendingAuth(env: Env, id: string, value: PendingAuth, ttl = 600): Promise<void> {
  await env.OAUTH_KV.put(pendingKey(id), JSON.stringify(value), { expirationTtl: ttl });
}

export async function consumePendingAuth(env: Env, id: string): Promise<PendingAuth | null> {
  const raw = await env.OAUTH_KV.get(pendingKey(id));
  if (!raw) return null;
  await env.OAUTH_KV.delete(pendingKey(id));
  try {
    return JSON.parse(raw) as PendingAuth;
  } catch {
    return null;
  }
}
