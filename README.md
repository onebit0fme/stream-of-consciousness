# Stream of Consciousness

A Claude Code plugin for neurodivergent brains.

Core philosophy to externalize the flow without enforcing any rigid structure that adds maintenance burden. The system is the flow, which means it doesn't try to *organize* your brain. Instead, it works *with* it. The stream has no fixed state, no concept of project, to-do or done. It is moment-to-moment system with build-in mechanism to eradicate clutter. Items flow in, decay over time, and either get resolved or restreamed. Continuity by design, embraced impermanence.

Designed for brains that don't do well with traditional task management systems.

## How it works

Everything in the stream has a **type** and a **decay period**:

| Type | Decay | What it is |
|------|-------|------------|
| task | 10 days | Something to do |
| thought | 7 days | A fleeting observation or concern |
| idea | 14 days | Something to explore or develop |
| output | 21 days | Something to produce or deliver |

Items don't get "done" — they **leave the stream** (resolved) or get **restreamed** (redefined). Decay forces regular triage without guilt. If something decays and you don't care, it was never important. If you do care, restream it.

## Prerequisites

- [Node.js](https://nodejs.org/) 20.18.1+
- [Claude Code](https://claude.com/download)

## Install

### As a Claude Code plugin

In Claude Code, run:

```
/plugin marketplace add onebit0fme/stream-of-consciousness
/plugin install stream-of-consciousness
```

### As a standalone MCP server

Add to your Claude Code MCP config (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "stream": {
      "command": "npx",
      "args": ["-y", "stream-of-consciousness"],
      "env": {
        "STREAM_BACKEND": "${STREAM_BACKEND:-file}",
        "TODOIST_API_TOKEN": "${TODOIST_API_TOKEN}",
        "TODOIST_PROJECT_ID": "${TODOIST_PROJECT_ID}"
      }
    }
  }
}
```

## Backends

The stream supports two storage backends:

### File (default)

Your stream lives at `~/.stream-of-consciousness`. A single JSON file, created automatically on first use. No configuration needed.

### Todoist

Uses the Todoist API as the full backend — items live in Todoist, visible in the mobile and web apps. Zero local state.

Set these environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `STREAM_BACKEND` | Yes | Set to `"todoist"` |
| `TODOIST_API_TOKEN` | Yes | Your [Todoist API token](https://todoist.com/help/articles/find-your-api-token-Jpzx9IIlB) |
| `TODOIST_PROJECT_ID` | No | Scope items to a specific project |

**Project scoping:** When `TODOIST_PROJECT_ID` is set, the stream is bound to that project — all reads and writes are scoped to it. When omitted, reads pull from all projects across your account, while new items go to Inbox. Setting a project ID is recommended for a clean, predictable stream.

**How it maps to Todoist:**

| Stream concept | Todoist field |
|---------------|---------------|
| type (task/thought/idea/output) | priority (P1/P2/P3/P4) |
| content | content + description (auto-split at 500 chars) |
| start date | due date (future only) |
| deadline | deadline |
| item ID | short unique suffix of Todoist task ID |

**Date handling:** Items with a future start date get a Todoist due date so they stay out of the stream until that date arrives. Items entering the stream today (or with a past start date) have no due date set — this avoids cluttering Todoist with "overdue" markers. Any existing due dates that have reached today are automatically cleared when the stream is read.

Items added directly in Todoist (e.g., from mobile) are automatically picked up. Priority determines the type. Restreaming adds a comment on the new task linking back to the original.

## Skills

When installed as a plugin, these slash commands are available:

| Command | What it does |
|---------|-------------|
| `/stream:add` | Add a task, thought, idea, or output |
| `/stream:resolve` | Resolve an item by ID or description |
| `/stream:restream` | Restream an item with changes |
| `/stream:flow` | Show everything in the stream |
| `/stream:attention` | Show what needs attention (decayed + deadline urgent) |
| `/stream:halflife` | Early warning — items approaching their decay point |

There's also a background skill that auto-activates when you discuss tasks, todos, or productivity with Claude.

## MCP Tools

The server exposes 4 tools that can be used by any MCP client:

| Tool | Description |
|------|-------------|
| `stream_add` | Add a new item (content, type, startDate, deadline) |
| `stream_resolve` | Resolve an item by ID |
| `stream_query` | Query items with filters (text search, type, status, decay range, deadline proximity) |
| `stream_restream` | Resolve an item and create a new version with lineage tracking |

## Development

```bash
git clone https://github.com/onebit0fme/stream-of-consciousness.git
cd stream-of-consciousness
npm install
npm run build
```

To test with the Todoist backend locally, create a `.env` file with your token and run:

```bash
source .env && STREAM_BACKEND=todoist node build/index.js
```

## Project structure

```
├── src/
│   ├── index.ts              — MCP server + tool handlers
│   ├── types.ts              — Types and constants
│   ├── utils.ts              — Date math, decay calculation, short IDs
│   ├── backend.ts            — Backend interface + factory
│   ├── file-backend.ts       — File storage backend
│   └── todoist-backend.ts    — Todoist API backend
├── plugins/
│   └── stream-of-consciousness/
│       ├── plugin.json       — plugin manifest
│       ├── .mcp.json         — MCP server config
│       └── skills/           — slash commands & background skill
├── .claude-plugin/
│   └── marketplace.json      — marketplace catalog
├── package.json
└── tsconfig.json
```

## License

MIT
