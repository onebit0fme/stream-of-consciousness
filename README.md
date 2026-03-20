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

## Install

### As a Claude Code plugin

```bash
git clone https://github.com/onebit0fme/stream-of-consciousness.git
cd stream
npm install
claude plugin add ./
```

### As a standalone MCP server

```bash
npm install -g stream-of-consciousness
```

Then add to your Claude Code MCP config (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "stream": {
      "command": "stream-of-consciousness"
    }
  }
}
```

### Data storage

Your stream lives at `~/.stream-of-consciousness`. It's a single JSON file, created automatically on first use.

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
cd stream
npm install
npm run build
```

After editing `src/index.ts`, run `npm run build`. Claude Code picks up the new build on the next tool call (new conversation).

## Project structure

```
├── src/index.ts           — MCP server source
├── skills/
│   ├── stream/SKILL.md    — background skill (auto-activates)
│   ├── add/SKILL.md       — /stream:add
│   ├── resolve/SKILL.md   — /stream:resolve
│   ├── restream/SKILL.md  — /stream:restream
│   ├── flow/SKILL.md      — /stream:flow
│   ├── attention/SKILL.md — /stream:attention
│   └── halflife/SKILL.md  — /stream:halflife
├── .claude-plugin/
│   └── plugin.json        — plugin manifest
├── .mcp.json              — MCP server config
├── package.json
└── tsconfig.json
```

## License

MIT
