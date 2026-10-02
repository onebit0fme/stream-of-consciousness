# Stream of Consciousness

A minimalist productivity system for neurodivergent brains.

Core philosophy: externalize the flow without enforcing rigid structure. The system is the flow — it doesn't try to *organize* your brain, it works *with* it. No fixed state, no concept of project, to-do, or done. Items flow in, decay over time, and either get resolved or restreamed. Continuity by design, embraced impermanence.

Designed for brains that don't do well with traditional task management.

## How it works

Everything in the stream has a **type**. Type classifies what your attention is *doing* with an item, not what it's about:

| Type | In a word | What it is |
|------|-----------|------------|
| run | doing | There is an action and you're on it. *Would I act on it today?* |
| drift | wondering | Interesting with no landing in sight; ask "so what would you do?" and you'd shrug. Fading is the feature — what matters resurfaces on its own. |

Both decay in 7 days.

Picture reality as a line running through time, and every item as a body in orbit around it. An orbit doesn't last: the item either falls into reality (**resolved**), breaks free of its pull (**escaped**), or is sent round again (**restreamed**).

Items don't get "done" — they **leave the stream** or get **restreamed**. Decay forces regular triage without guilt. If something decays and you don't care, it was never important. If you do care, restream it.

- **Restreaming** is re-encoding: you rewrite the item, and its decay clock starts over. It stays the same item, and the wording it had moves into its history as a dated line, so an item carries the record of every time it has come round.
- A restreamed run is a **pull** — an action you keep circling. A restreamed drift is a **muse** — a thought you keep returning to. Neither is a type; both are read off an item's history, and neither buys extra time.
- An item leaves as **resolved** (it's done) or **escaped** (dropped).

In Capacities ([Path D](#path-d--capacities)) there is also a **slow stream**: **wishes** (a state you want to be true) and **obstacles** (what currently stands between you and a wish), which decay over a month. A run links to the obstacle it works on; a drift or an obstacle links to its wish. Setting a wish against what stands in its way is what keeps it motivating, so the slow stream holds no plans, milestones, or imagined outcomes.

## Quickstart — pick your path

| Path | Best for | Where it runs | Where your data lives | Setup |
|---|---|---|---|---|
| **A. Local file** | You work in Claude Code, no mobile sync needed | local stdio (Claude Code only) | a JSON file at `~/.stream-of-consciousness` | ~1 min |
| **B. Local + Todoist** | Claude Code + you want items on your phone via Todoist's app | local stdio (Claude Code only) | your Todoist account | ~5 min |
| **C. Remote MCP** | You want the stream in Claude.ai (web, desktop, mobile) | Cloudflare Workers (yours) | your Todoist account | ~15 min — see [docs/cloudflare-deploy.md](docs/cloudflare-deploy.md) |

| **D. Capacities** | Your stream lives in Capacities as native object types, with the slow stream alongside | the Capacities MCP (Claude Code or Claude.ai) | your Capacities space | ~10 min, by hand — see [Path D](#path-d--capacities) |

**B and C share the same Todoist account, so they share the same stream.** Use both at once if you want.

Paths A–C are one plugin, `stream-of-consciousness`, with its own MCP server. Path D is a separate plugin, `stream-capacities`, with no server of its own: it is a pair of skills that drive Capacities' official MCP.

---

## Path A — local file

Install as a Claude Code plugin:

```
/plugin marketplace add onebit0fme/stream-of-consciousness
/plugin install stream-of-consciousness
```

That's it. Your stream lives at `~/.stream-of-consciousness`. The plugin auto-installs the slash commands and the background skill.

## Path B — local + Todoist sync

Same plugin install as Path A, then set two environment variables for your Claude Code MCP config (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "stream": {
      "command": "npx",
      "args": ["-y", "stream-of-consciousness"],
      "env": {
        "STREAM_BACKEND": "todoist",
        "TODOIST_API_TOKEN": "<your-token>",
        "TODOIST_PROJECT_ID": "<optional-project-id>"
      }
    }
  }
}
```

Get your token from <https://todoist.com/help/articles/find-your-api-token-Jpzx9IIlB>. Optionally scope the stream to a specific project — strongly recommended for a clean experience (see [Project scoping](#project-scoping) below). Restart Claude Code.

Items now live in Todoist. They appear in Todoist's mobile and web apps. Items you add directly in Todoist are automatically picked up by the stream.

## Path C — remote MCP (Claude.ai connector)

Deploy your own remote MCP server to Cloudflare Workers, then add it to Claude.ai as a custom connector. Each user (you, and anyone you share it with) signs in with their own Todoist account via OAuth.

This is power-user territory — see **[docs/cloudflare-deploy.md](docs/cloudflare-deploy.md)** for the full walk-through.

## Path D — Capacities

```
/plugin marketplace add onebit0fme/stream-of-consciousness
/plugin install stream-capacities
```

The plugin connects Claude to Capacities' MCP server (`https://api.capacities.io/mcp`); you sign in to Capacities the first time it's used. If you already have a Capacities connector, the skills use that.

Runs, drifts, wishes and obstacles are four object types in your space, with links between them as object properties. Capacities' MCP can't create object types, so setup is done once by hand — ask Claude to *set up the stream in Capacities* and the `setup` skill walks you through the types and properties, then checks them.

How it maps:

| Stream concept | Capacities |
|---------------|------------|
| type | object type: `Run`, `Drift`, `Wish`, `Obstacle` |
| content | title, plus body for detail |
| link | object property (`Obstacle` on a run; `Wish` on a drift or obstacle) |
| decay clock | a run or drift's created date, which is the day it enters the stream (set it in the future for something that shouldn't be in view yet); a wish or obstacle's last-updated date |
| restream | title rewritten in place, created date reset, the old title kept as a dated line at the top of the body |
| dropping an item | moved to the trash (restorable for 30 days) |
| finishing an item | yours to do in the app — Capacities' MCP can't change an object's type, and what a finished item becomes is up to you |

---

## Backends

### File (Path A)

Your stream lives at `~/.stream-of-consciousness`. A single JSON file, created automatically on first use. No configuration needed; set `STREAM_FILE` to keep it somewhere else.

### Todoist (Paths B + C)

Uses the Todoist API as the full backend — items live in Todoist, visible everywhere Todoist is. Resolved and escaped items both complete the task.

For Path B (stdio):

| Variable | Required | Description |
|----------|----------|-------------|
| `STREAM_BACKEND` | Yes | Set to `"todoist"` |
| `TODOIST_API_TOKEN` | Yes | Your [Todoist API token](https://todoist.com/help/articles/find-your-api-token-Jpzx9IIlB) |
| `TODOIST_PROJECT_ID` | No | Scope items to a specific project |

For Path C, OAuth handles credentials; project selection happens via the picker page during first connect.

#### Project scoping

When a project ID is set (Path B env var, or Path C picker), the stream is bound to that project — all reads and writes are scoped to it. For Path B without a project ID, reads pull from all projects across your account, while new items go to Inbox. **Setting a project is strongly recommended for a clean, predictable stream.**

#### How it maps to Todoist

| Stream concept | Todoist field |
|---------------|---------------|
| type (run/drift) | section: `Run` — `drift` has no section (the section is auto-created on demand) |
| content | content + description (auto-split at first newline; 500-char title limit handled with a sentinel) |
| comments | folded into content (oldest first); carried into the body on restream |
| history | dated `↻` lines at the end of the description, most recent first |
| restream | the task is completed and a new one created with the rewritten content — a task's age can't be reset |
| start date | due date (future only) |
| deadline | deadline |
| item ID | short unique suffix of Todoist task ID |

**Date handling:** Items with a future start date get a Todoist due date so they stay out of the stream until that date arrives. Items entering the stream today (or with a past start date) have no due date set — this avoids cluttering Todoist with "overdue" markers. Any existing due dates that have reached today are automatically cleared when the stream is read.

Items added directly in Todoist (e.g., from mobile) are automatically picked up. The task's **section** determines its type (`Run`; no section = `drift`). A section named `Live` or `Pull` also reads as run, and `Muse` as drift. **Comments** on a task (e.g. notes jotted from mobile) are folded into its content, oldest first, and become part of the item's body when it's restreamed.

## Skills

Skills teach Claude how to interact with the stream — when to add, when to resolve, when to restream, how to triage, what tone to use. There are no slash commands; just describe what you want or share what's on your mind and Claude acts.

**Path A + B (Claude Code plugin):** the plugin auto-installs a background skill that activates whenever you discuss tasks, todos, productivity, or what's on your mind.

**Path D (Capacities plugin):** installs two skills — `stream`, which runs in the background like the one above, and `setup`, for the one-time creation of the object types.

**Path C (Claude.ai connector):** add the skill manually. Your deployed worker serves it at `https://<your-worker-domain>/skill.md` — copy that into your Claude.ai project as a skill.

Paths A–C use the exact same skill file (`plugins/stream-of-consciousness/skills/stream/SKILL.md`) — same philosophy, same tone, same operations, single source of truth. The Capacities skill shares the rewrite deck with it, word for word.

## MCP tools

The server exposes five tools — same surface on every path:

| Tool | Description |
|------|-------------|
| `stream_add` | Add a new item (content, type, startDate, deadline) |
| `stream_resolve` | Take an item out of the stream by ID, as resolved or escaped |
| `stream_query` | Query items with filters (text search, type, status, restreamed, decay range, deadline proximity) |
| `stream_restream` | Re-encode an item and restart its decay — the old wording moves into its history |
| `stream_update` | Set an item's deadline in place — no decay reset |

## Development

```bash
git clone https://github.com/onebit0fme/stream-of-consciousness.git
cd stream-of-consciousness
npm install
npm run build
npm test
```

To test the Todoist backend locally over stdio, create a `.env` file with your token and run:

```bash
source .env && STREAM_BACKEND=todoist node build/index.js
```

To work on the Worker:

```bash
npm run worker:dev        # local dev server on :8788
npm run worker:typecheck  # typecheck only
npm run worker:deploy     # deploy to Cloudflare
```

## Project structure

```
├── src/
│   ├── index.ts              — stdio MCP server entry
│   ├── tools.ts              — tool definitions (shared by stdio + worker)
│   ├── types.ts              — types and constants
│   ├── utils.ts              — date math, decay, short IDs
│   ├── backend.ts            — StreamBackend interface
│   ├── backend-factory.ts    — env-driven backend selection (stdio only)
│   ├── file-backend.ts       — file storage backend
│   ├── todoist-backend.ts    — Todoist API backend (shared)
│   └── worker/               — Cloudflare Worker (Path C)
│       ├── index.ts          — OAuthProvider wiring (worker entry)
│       ├── mcp-agent.ts      — StreamMCP Durable Object
│       ├── todoist-handler.ts— Hono routes (OAuth proxy + project picker)
│       ├── todoist-oauth.ts  — Todoist token exchange + refresh
│       ├── todoist-api.ts    — user info fetch
│       ├── todoist-rest.ts   — direct-fetch project list/create
│       ├── project-picker.ts — project selection HTML
│       ├── refreshing-backend.ts — TodoistBackend wrapper w/ token refresh
│       ├── token-store.ts    — KV-backed Todoist credentials + pending auth
│       ├── consent.ts        — consent dialog + CSRF/state helpers
│       └── types.ts          — Env + Props
├── plugins/
│   ├── stream-of-consciousness/
│   │   ├── plugin.json       — plugin manifest
│   │   ├── .mcp.json         — MCP server config
│   │   └── skills/stream/    — background skill (Path A + B)
│   └── stream-capacities/
│       ├── plugin.json       — plugin manifest
│       ├── .mcp.json         — points at Capacities' MCP server
│       ├── skills/stream/    — background skill + rewrite deck (Path D)
│       └── skills/setup/     — one-time object type setup
├── .claude-plugin/
│   └── marketplace.json      — marketplace catalog
├── docs/
│   └── cloudflare-deploy.md  — Path C deploy walk-through
├── wrangler.jsonc            — Cloudflare Workers deploy config
├── package.json
├── tsconfig.json             — stdio build
└── tsconfig.worker.json      — worker typecheck
```

## License

MIT
