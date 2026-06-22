import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
// @ts-expect-error — Wrangler bundles *.md files as text via the rule in wrangler.jsonc
import skillMarkdown from "../../plugins/stream-of-consciousness/skills/stream/SKILL.md";
import {
  OAuthError,
  addApprovedClient,
  bindStateToSession,
  createOAuthState,
  generateCSRFProtection,
  isClientApproved,
  renderApprovalDialog,
  validateCSRFToken,
  validateOAuthState,
} from "./consent.js";
import { buildTodoistAuthorizeUrl, computeTokenExpiry, exchangeTodoistCode } from "./todoist-oauth.js";
import { fetchTodoistUser } from "./todoist-api.js";
import { createProject, listProjects } from "./todoist-rest.js";
import { DEFAULT_NEW_PROJECT_NAME, renderProjectPicker } from "./project-picker.js";
import {
  consumePendingAuth,
  writeCredentials,
  writePendingAuth,
  type PendingAuth,
} from "./token-store.js";
import type { Env, Props } from "./types.js";

type Bindings = Env & { OAUTH_PROVIDER: OAuthHelpers };

export const todoistHandler = new Hono<{ Bindings: Bindings }>();

const SERVER_INFO = {
  name: "Stream of Consciousness",
  description:
    "A minimalist productivity stream with time-based decay, backed by Todoist. Items flow in, decay, and either get resolved or restreamed.",
};

function callbackUrl(request: Request): string {
  return new URL("/callback", request.url).href;
}

/** Runs an upstream call and, on failure, returns a 502 Response with the error message inlined. */
async function tryUpstream<T>(label: string, fn: () => Promise<T>): Promise<T | Response> {
  try {
    return await fn();
  } catch (err) {
    console.error(`${label} failed:`, err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`${label} failed: ${msg}`, { status: 502 });
  }
}

async function redirectToTodoist(
  c: { req: { raw: Request }; env: Bindings },
  stateToken: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return new Response(null, {
    status: 302,
    headers: {
      ...extraHeaders,
      Location: buildTodoistAuthorizeUrl({
        clientId: c.env.TODOIST_CLIENT_ID,
        redirectUri: callbackUrl(c.req.raw),
        state: stateToken,
      }),
    },
  });
}

todoistHandler.get("/", (c) => {
  const mcpUrl = new URL("/mcp", c.req.url).href;
  const skillUrl = new URL("/skill.md", c.req.url).href;
  return c.html(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${SERVER_INFO.name}</title>
<style>body{font-family:-apple-system,sans-serif;max-width:640px;margin:4rem auto;padding:1rem;color:#333;line-height:1.6}code{background:#f3f4f6;padding:.1rem .35rem;border-radius:4px;font-size:.9em}.step{margin:1rem 0}</style>
</head><body>
<h1>${SERVER_INFO.name}</h1>
<p>${SERVER_INFO.description}</p>
<p>This is a remote MCP server. To connect from Claude.ai:</p>
<ol>
  <li class="step">Add this as a custom connector: <code>${mcpUrl}</code></li>
  <li class="step">Sign in with your Todoist account and pick a project.</li>
  <li class="step">Install the skill — copy the contents of <a href="${skillUrl}"><code>/skill.md</code></a> into your Claude.ai project as a skill so Claude knows how to use the stream.</li>
</ol>
</body></html>`);
});

todoistHandler.get("/skill.md", (c) => {
  return new Response(skillMarkdown as string, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});

todoistHandler.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const { clientId } = oauthReqInfo;
  if (!clientId) return c.text("Invalid request", 400);

  if (await isClientApproved(c.req.raw, clientId, c.env.COOKIE_ENCRYPTION_KEY)) {
    const { stateToken } = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV);
    const { setCookie } = await bindStateToSession(stateToken);
    return redirectToTodoist(c, stateToken, { "Set-Cookie": setCookie });
  }

  const { token: csrfToken, setCookie } = generateCSRFProtection();
  return renderApprovalDialog(c.req.raw, {
    client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
    csrfToken,
    server: SERVER_INFO,
    setCookie,
    state: { oauthReqInfo },
  });
});

todoistHandler.post("/authorize", async (c) => {
  try {
    const formData = await c.req.raw.formData();
    validateCSRFToken(formData, c.req.raw);

    const encodedState = formData.get("state");
    if (!encodedState || typeof encodedState !== "string") {
      return c.text("Missing state in form data", 400);
    }

    let state: { oauthReqInfo?: AuthRequest };
    try {
      state = JSON.parse(atob(encodedState));
    } catch {
      return c.text("Invalid state data", 400);
    }

    if (!state.oauthReqInfo?.clientId) return c.text("Invalid request", 400);

    const approvedCookie = await addApprovedClient(
      c.req.raw,
      state.oauthReqInfo.clientId,
      c.env.COOKIE_ENCRYPTION_KEY,
    );
    const { stateToken } = await createOAuthState(state.oauthReqInfo, c.env.OAUTH_KV);
    const { setCookie: sessionCookie } = await bindStateToSession(stateToken);

    const headers = new Headers();
    headers.append("Set-Cookie", approvedCookie);
    headers.append("Set-Cookie", sessionCookie);
    return redirectToTodoist(c, stateToken, Object.fromEntries(headers));
  } catch (err) {
    if (err instanceof OAuthError) return err.toResponse();
    console.error("POST /authorize error:", err);
    return c.text("Internal server error", 500);
  }
});

todoistHandler.get("/callback", async (c) => {
  let oauthReqInfo: AuthRequest;
  let clearSessionCookie: string;

  try {
    const result = await validateOAuthState(c.req.raw, c.env.OAUTH_KV);
    oauthReqInfo = result.oauthReqInfo;
    clearSessionCookie = result.clearCookie;
  } catch (err) {
    if (err instanceof OAuthError) return err.toResponse();
    console.error("Callback validation error:", err);
    return c.text("Internal server error", 500);
  }

  const code = c.req.query("code");
  if (!code) return c.text("Missing code", 400);
  if (!oauthReqInfo.clientId) return c.text("Invalid OAuth request data", 400);

  const token = await tryUpstream("Todoist code exchange", () =>
    exchangeTodoistCode({
      clientId: c.env.TODOIST_CLIENT_ID,
      clientSecret: c.env.TODOIST_CLIENT_SECRET,
      code,
      redirectUri: callbackUrl(c.req.raw),
    }),
  );
  if (token instanceof Response) return token;

  const userAndProjects = await tryUpstream("Todoist user + projects fetch", () =>
    Promise.all([fetchTodoistUser(token.access_token), listProjects(token.access_token)]),
  );
  if (userAndProjects instanceof Response) return userAndProjects;
  const [user, projects] = userAndProjects;

  const pendingId = crypto.randomUUID();
  const pending: PendingAuth = {
    oauthReqInfo,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: computeTokenExpiry(token.expires_in),
    userId: user.id,
    userName: user.fullName,
    projectIds: projects.map((p) => p.id),
  };
  await writePendingAuth(c.env, pendingId, pending);

  const picker = renderProjectPicker({ pendingId, projects, userName: user.fullName });
  const responseHeaders = new Headers(picker.headers);
  if (clearSessionCookie) responseHeaders.append("Set-Cookie", clearSessionCookie);
  return new Response(picker.html, { headers: responseHeaders });
});

todoistHandler.post("/select-project", async (c) => {
  let formData: FormData;
  try {
    formData = await c.req.raw.formData();
  } catch {
    return c.text("Invalid form data", 400);
  }

  const pendingId = formData.get("pending_id");
  const choice = formData.get("choice");
  if (typeof pendingId !== "string" || typeof choice !== "string") {
    return c.text("Missing pending_id or choice", 400);
  }

  const pending = await consumePendingAuth(c.env, pendingId);
  if (!pending) return c.text("Authorization session expired — please reconnect", 400);

  let streamProjectId: string;
  if (choice === "new") {
    const created = await tryUpstream("Todoist create project", () =>
      createProject(pending.accessToken, DEFAULT_NEW_PROJECT_NAME),
    );
    if (created instanceof Response) return created;
    streamProjectId = created.id;
  } else if (choice.startsWith("existing:")) {
    const id = choice.slice("existing:".length);
    if (!pending.projectIds.includes(id)) {
      return c.text("Selected project not in allowed list", 400);
    }
    streamProjectId = id;
  } else {
    return c.text("Invalid choice", 400);
  }

  // Shared per-user record holds only the tokens — they're identical across all
  // of this user's connections. The project scope is per-connection and goes
  // into the grant props below, so a second connection can't clobber the first.
  await writeCredentials(c.env, pending.userId, {
    accessToken: pending.accessToken,
    refreshToken: pending.refreshToken,
    expiresAt: pending.expiresAt,
  });

  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    metadata: { label: pending.userName },
    props: { todoistUserId: pending.userId, streamProjectId } satisfies Props,
    request: pending.oauthReqInfo,
    scope: pending.oauthReqInfo.scope,
    userId: pending.userId,
  });

  return new Response(null, { status: 302, headers: { Location: redirectTo } });
});
