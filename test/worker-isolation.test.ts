import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RefreshingTodoistBackend,
  type TodoistBackendFactory,
} from "../src/worker/refreshing-backend.js";
import { writeCredentials } from "../src/worker/token-store.js";
import type { StreamBackend } from "../src/backend.js";
import type { Env } from "../src/worker/types.js";

/** Minimal in-memory KV covering only the bits of KVNamespace the token store touches. */
function makeEnv(): Env {
  const store = new Map<string, string>();
  const kv = {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => {
      store.set(k, v);
    },
    delete: async (k: string) => {
      store.delete(k);
    },
  };
  return { OAUTH_KV: kv } as unknown as Env;
}

/** A backend factory that records every (token, projectId) it is asked to build. */
function recordingFactory(): {
  factory: TodoistBackendFactory;
  calls: Array<{ accessToken: string; projectId: string }>;
} {
  const calls: Array<{ accessToken: string; projectId: string }> = [];
  const stub: StreamBackend = {
    add: async () => {
      throw new Error("not exercised");
    },
    resolve: async () => null,
    restream: async () => null,
    query: async () => [],
  };
  const factory: TodoistBackendFactory = (accessToken, projectId) => {
    calls.push({ accessToken, projectId });
    return stub;
  };
  return { factory, calls };
}

// Regression for the cross-connection project leak: two MCP connections (OAuth
// grants) for the SAME Todoist user share one credential record, but each must
// stay scoped to the project chosen for *that* connection. Previously the project
// lived in the shared per-user record, so authorizing a second connection
// overwrote the first's project — and the first connection then served the
// second's items.
test("two connections for the same user keep their own project scope", async () => {
  const env = makeEnv();
  const userId = "user-42";

  // One shared per-user credential record — both connections resolve to it.
  await writeCredentials(env, userId, {
    accessToken: "shared-token",
    refreshToken: "shared-refresh",
    expiresAt: null,
  });

  // Connection A (e.g. claude.ai) scoped to the "Stream" project.
  const a = recordingFactory();
  const backendA = await RefreshingTodoistBackend.create(env, userId, "project-stream", a.factory);

  // Connection B (e.g. local .mcp.json) scoped to a different project — authorized second.
  const b = recordingFactory();
  const backendB = await RefreshingTodoistBackend.create(env, userId, "project-bzboo", b.factory);

  // Exercise both so each lazily builds its underlying backend.
  await backendA.query({ status: "active" });
  await backendB.query({ status: "active" });

  // Both share the one token...
  assert.equal(a.calls[0].accessToken, "shared-token");
  assert.equal(b.calls[0].accessToken, "shared-token");

  // ...but each is scoped to its own project. B's project must not leak into A.
  assert.equal(a.calls[0].projectId, "project-stream");
  assert.equal(b.calls[0].projectId, "project-bzboo");
  assert.notEqual(a.calls[0].projectId, b.calls[0].projectId);
});
