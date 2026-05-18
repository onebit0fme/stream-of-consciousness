# Deploying Stream of Consciousness to Cloudflare Workers

This is the **Path C** deploy guide: a self-hosted remote MCP server on Cloudflare Workers that you connect to Claude.ai (web, desktop, mobile) as a custom connector. It proxies authentication to Todoist so each connected user signs in with their own Todoist account.

This is power-user territory. Expect ~15 minutes if you've used Cloudflare and Todoist's developer console before, more if you haven't.

If you just want the stream locally in Claude Code, you don't need any of this — see the [README](../README.md) Path A or Path B.

## What you'll end up with

- A Cloudflare Worker at `https://<your-domain>/mcp` exposing the four Stream MCP tools over Streamable HTTP.
- An OAuth flow at `/authorize` → Todoist sign-in → project picker → connected.
- A connector URL you paste into Claude.ai, which dynamically registers itself.
- A skill at `https://<your-domain>/skill.md` you can copy into your Claude.ai project to teach Claude how to use the stream.

Each connected user gets their own Todoist OAuth token, their own picked project, their own isolated stream. The server itself is stateless beyond Cloudflare KV.

## Prerequisites

- A Cloudflare account (the free tier is enough — Workers free plan covers 100K requests/day).
- A Todoist account with access to the [App Management Console](https://app.todoist.com/app/settings/integrations/app-management).
- Node.js 20.18.1+ and `git` locally.
- *(Optional)* A custom domain in Cloudflare. Without one, you'll get a `*.workers.dev` URL instead — works fine, just looks less clean.
- Wrangler authenticated against your account: `npx wrangler login` (opens browser).

## One-time setup

### 1. Bootstrap your Cloudflare account (first time only)

Cloudflare requires every account to have a `*.workers.dev` subdomain provisioned before any worker can deploy. To create it, sign in to <https://dash.cloudflare.com> and click "Workers & Pages" in the sidebar. Visiting the landing page once is enough — it auto-provisions the subdomain.

### 2. Clone the repo and install

```bash
git clone https://github.com/onebit0fme/stream-of-consciousness.git
cd stream-of-consciousness
npm install
```

### 3. Register a Todoist OAuth app

Open <https://app.todoist.com/app/settings/integrations/app-management> and create a new app. Fill in:

- **App name** — what users will see on the Todoist consent screen (e.g. "Stream of Consciousness").
- **App service email** — optional.
- **App URL** — your worker's URL once deployed, e.g. `https://<your-domain>/`.
- **OAuth redirect URL** — `https://<your-domain>/callback`. You can add a second one (`http://localhost:8788/callback`) if you want to develop locally with `wrangler dev`.

Save. Copy the **Client ID** and **Client secret** — you'll need them in a moment.

### 4. Configure the worker

Open `wrangler.jsonc`. Two things to set:

**KV namespace.** Create one and paste the returned `id`:

```bash
npx wrangler kv namespace create OAUTH_KV
```

Copy the returned `id` into `kv_namespaces[0].id`.

**Domain.** If you have a custom domain, update the `routes` block:

```jsonc
"routes": [{ "pattern": "stream.your-domain.com", "custom_domain": true }]
```

The domain's zone must already be managed by Cloudflare (the custom_domain route auto-creates the DNS record, but not the zone itself). If you don't have a custom domain, delete the `routes` array entirely — Cloudflare will serve you on `https://stream-of-consciousness.<your-workers-subdomain>.workers.dev`.

### 5. Set secrets

Three values. Wrangler stores them encrypted in your account:

```bash
npx wrangler secret put TODOIST_CLIENT_ID
npx wrangler secret put TODOIST_CLIENT_SECRET
npx wrangler secret put COOKIE_ENCRYPTION_KEY
```

- `TODOIST_CLIENT_ID` / `TODOIST_CLIENT_SECRET` — from the Todoist app you registered in step 3.
- `COOKIE_ENCRYPTION_KEY` — any random 32+ byte string. Used to sign the approval cookie (`__Host-APPROVED_CLIENTS`) so returning users skip the consent dialog. Generate one with `openssl rand -hex 32`.

### 6. Deploy

```bash
npm run worker:deploy
```

Wrangler builds, uploads, and prints your worker URL.

### 7. Connect to Claude.ai

In Claude.ai, go to **Settings → Connectors → Add custom connector**. Paste your URL with `/mcp`:

```
https://<your-domain>/mcp
```

Claude will dynamically register itself (DCR), redirect through Todoist OAuth, show the project picker, and complete the connection.

### 8. Install the skill

The worker also serves the skill file at `/skill.md`. In Claude.ai, open the project where you want the stream, and add it as a skill — paste the contents of `https://<your-domain>/skill.md` (or attach the file).

## Day-to-day operations

### Updating

```bash
git pull
npm install
npm run worker:deploy
```

Issued MCP tokens survive across deploys — Cloudflare KV persists them.

### Watching logs

```bash
npx wrangler tail
```

Or enable Logpush from the Cloudflare dashboard if you want persistent logs.

### Rotating secrets

```bash
npx wrangler secret put COOKIE_ENCRYPTION_KEY
```

Hot — no redeploy needed. Rotating `COOKIE_ENCRYPTION_KEY` invalidates in-flight consent flows (users get a fresh consent dialog) but does not invalidate already-issued MCP tokens. Rotating Todoist client credentials forces all users to reconnect.

### Inspecting KV

```bash
npx wrangler kv key list --binding=OAUTH_KV
```

Keys you'll see:
- `oauth:state:<uuid>` — short-lived OAuth state (10 min TTL).
- `pending:auth:<uuid>` — short-lived pending-auth state during project picker (10 min TTL).
- `todoist:user:<id>` — long-lived Todoist credentials per connected user.
- Internal keys from `@cloudflare/workers-oauth-provider` (issued tokens, registered clients).

### Removing a user

To force a user to reconnect:

```bash
npx wrangler kv key delete --binding=OAUTH_KV "todoist:user:<their-todoist-user-id>"
```

Their next MCP call gets a 401, Claude.ai walks them through OAuth again.

## Local development

```bash
npm run worker:dev
```

Starts on `http://localhost:8788`. KV and Durable Objects run locally in-memory. Your Todoist OAuth app needs `http://localhost:8788/callback` in its allowed redirect URLs.

Inspect the MCP surface with:

```bash
npx @modelcontextprotocol/inspector
```

Then point it at `http://localhost:8788/mcp`.

## Troubleshooting

### "You need a workers.dev subdomain in order to proceed"

You haven't visited the Workers dashboard yet. See step 1 above.

### "Invalid redirect URI" from Todoist

The `redirect_uri` your worker is sending isn't in your Todoist app's allowed URLs. Exact match required including protocol, host, port, path, trailing slash. Check the App Management Console.

### "MessagePort is not defined" in tool calls

This means the `nativeFetchAdapter` isn't being used. Verify `src/worker/refreshing-backend.ts` calls `new TodoistBackend(..., { useNativeFetch: true })`. (Without that, the Todoist SDK tries to `import('undici')`, which needs `worker_threads`/`MessagePort` that Workers doesn't ship.)

### "Invalid Routes: Wildcard operators (*) are not allowed in Custom Domains"

In `wrangler.jsonc`, your `routes` pattern should be a bare hostname (e.g. `"stream.example.com"`), not `"stream.example.com/*"`. Custom Domains take all paths automatically.

### Connector connects but tool calls fail silently

`wrangler tail` is your friend. The worker logs every Todoist API error verbatim. Common ones:
- 401 → refresh path failed; user needs to reconnect.
- 403 → Todoist account doesn't have the right scope (we ask for `data:read_write` only).
- 404 → Stream project was deleted in Todoist; remove `todoist:user:<id>` from KV to force re-pick.

### How do I change the project a user is scoped to?

Currently: revoke the connector in Claude.ai and re-add. The project picker shows up again. A persistent "change project" UI is on the wishlist but not yet built.

## Architecture (for the curious)

- **OAuth provider** — `@cloudflare/workers-oauth-provider` exposes us as an OAuth 2.1 Authorization Server with DCR. Claude.ai is the *client*, our worker is the *AS*, Todoist is the upstream *IdP*.
- **MCP transport** — `agents/mcp`'s `McpAgent` class provides Streamable HTTP transport on top of a Cloudflare Durable Object for per-session state.
- **Token refresh** — Todoist issues 1-hour access tokens with rotating refresh tokens. `RefreshingTodoistBackend` wraps the shared `TodoistBackend`, watching for 401 / expiry and refreshing transparently.
- **Storage** — Cloudflare KV. Todoist creds, OAuth state, pending picker selections, issued MCP tokens (managed by the OAuth provider).
- **Why a custom fetch adapter?** The Todoist SDK uses `undici` for HTTP, which depends on Node's `worker_threads` / `MessagePort`. Workers' `nodejs_compat` flag doesn't ship those (with the compat date we're on). The SDK has a `customFetch` option that bypasses its undici dispatcher — we hand it Workers' native `fetch`.

If you want to read the code, start at `src/worker/index.ts` and follow the imports.
