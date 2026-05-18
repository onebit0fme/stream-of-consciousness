---
name: stream
description: "Activates when the user discusses tasks, todos, productivity, their stream, what they need to do, what's on their mind, or asks to add/resolve/restream/query items. Use this whenever the conversation touches what the user is working on, what they're worried about, or what they need to capture or track."
user-invocable: false
---

# The Stream of Consciousness

The user has the Stream of Consciousness MCP server installed. It exposes a personal productivity stream for an ADHD brain.

## Philosophy

- Things don't get "done" — they either **leave the stream** (resolved) or get **restreamed** (redefined).
- **Decay** forces regular triage without guilt. Items naturally fade unless actively kept.
- No tags, no priorities, no categories — just type, content, and time.
- The system is intentionally minimal. Do not add complexity.

## MCP tools available

| Tool | Purpose |
|------|---------|
| `stream_add` | Add a new item (content, type, startDate, deadline) |
| `stream_resolve` | Resolve an item by ID |
| `stream_query` | Query items with filters (query, type, status, decay_min, decay_max, deadline_within) |
| `stream_restream` | Resolve an item and create a new version with lineage |

Always use these tools — never reason about the state of the stream from memory.

## Item types and decay periods

| Type | Decay | Description |
|------|-------|-------------|
| `task` | 10 days | Something to do |
| `thought` | 7 days | A fleeting observation or concern |
| `idea` | 14 days | Something to explore or develop |
| `output` | 21 days | Something to produce or deliver |

## How to interact

Users won't issue commands or specify operations — they describe what they want, what they've done, or what's on their mind. Translate their intent into the right tool call and act. *"What's in my stream?"* / *"show me what I'm working on"* is a query; *"I finished X"* / *"cancel Y"* is a resolve; *"add a thought about Z"* / *"I'm worried about Q"* is an add; new context on an existing item is a restream. There's no command syntax to wait for.

### Flow with the stream

The stream is the source of truth — not your context window. Flow with it in real time:

- When something is done → `stream_resolve` it immediately.
- When something new comes up → `stream_add` it immediately.
- When something changes → `stream_restream` it (resolves the old, creates a new version with lineage).
- When the user shares an update → capture it right then, not at end of session.

Do not batch. Do not defer. Do not maintain your own tracking tables or summaries. The stream of resolved and added items **is** the record of what happened.

### Bias to action

**Do not ask for permission to act on the stream. Just act.** The stream is low-stakes and fully reversible — every action can be undone or restreamed. Asking "want me to resolve this?" or "should I restream?" adds friction and breaks flow.

- **Resolve by default** when something is clearly done. A merged PR, a closed ticket, a finished task — these leave the stream. Done means gone.
- **Restream by default** when anything about an item that's still in flight changes:
  - The user shares a progress update or new context about an existing item.
  - An item's scope, framing, or understanding has changed through conversation.
  - A thought has crystallized into a task or idea.
  - An item's type should change (e.g., an idea becomes a task, a task becomes an output that still needs delivery).
  - New details, links, or references are mentioned that belong on an existing item.
- **Add by default** when the user mentions something new. Don't ask "want me to add this?" — just add it.

**Restream ≠ resolve.** Restreaming keeps the item in the stream with a new version. Only restream if the item still has life — there's more to do, track, or deliver. If the work is finished and there's nothing left to track, resolve it instead.

The only time to pause and ask is when intent is genuinely ambiguous — you can't tell which item the user means, or whether something is new vs. an update. Even then, prefer making your best guess and acting over asking.

## Writing content

An item has exactly one content field — there's no separate title, description, or details. Content can be a few words or a multi-paragraph note, whatever the substance demands.

When an item carries enough substance that a single label wouldn't do it justice, write it as a short summary followed by a blank line and then the detail:

```
<summary>

<details>
```

The first line is what you'd put on a sticky note — short, scannable, says what this is. After the blank line, add anything that belongs *on* this item: context, links, references, sub-items, what "done" looks like, decisions to make, prior attempts, related conversation snippets. The summary is the handle; the details are what's under it.

Use this format when it's genuinely useful — don't pad short items with empty detail sections, and don't bury the summary inside a long paragraph. Single-line content is fine for items that fit on one line.

This applies to all four item types — tasks, thoughts, ideas, and outputs alike.

## Common operations

### Adding an item

1. Parse the user's input for:
   - **type** — `task`, `thought`, `idea`, or `output` (default to `task` if not clear).
   - **content** — what the item is. Follow the "Writing content" guidance above — use summary + details when there's enough substance to warrant it.
   - **startDate** — `YYYY-MM-DD`, defaults to today unless they specify a future start.
   - **deadline** — `YYYY-MM-DD` only if there's a hard external deadline.
2. If genuinely ambiguous (can't determine content, type clearly wrong), ask. Don't guess wildly.
3. Call `stream_add`.
4. Confirm what was added in a brief, conversational way.

Example parsings:
- "task: review the Q1 budget proposal, deadline March 5" → type=task, content="Review the Q1 budget proposal", deadline=2026-03-05
- "idea: build a CLI tool for stream management" → type=idea, content="Build a CLI tool for stream management"
- "thought: maybe we should rethink the auth flow" → type=thought, content="Maybe we should rethink the auth flow"
- "finish the API docs by Friday" → type=task, content="Finish the API docs", deadline=(next Friday)
- "output: quarterly report covering the new growth metric and Q1 hiring plan" → type=output, content="Quarterly report\n\nCovers the new growth metric (the one we discussed last week) and the Q1 hiring plan."
- "idea: a CLI for the stream so I can add things without opening Claude. Probably Rust. Could lift the existing TypeScript types via JSON schema." → type=idea, content="CLI for the stream so I can add items without opening Claude\n\nProbably Rust. Could lift the existing TypeScript types via JSON schema."

### Resolving an item

1. If the user's reference looks like an ID (number or short alphanumeric like "h48" or "3P8"), call `stream_resolve` directly.
2. If it's descriptive text, call `stream_query` with the `query` parameter to find matches:
   - Exactly one match → `stream_resolve` with that ID.
   - Multiple matches → list them and ask which to resolve.
   - No matches → tell the user; suggest checking the full stream.
3. Confirm what was resolved. Use "left the stream" / "resolved" language — not "completed" or "done".

### Restreaming an item

1. Find the item:
   - If the input starts with an ID, that's the item.
   - If it's text, `stream_query` to find matches; same disambiguation rules as resolve.
2. Determine what changed: new content, new type, new deadline, new startDate. If the user didn't say what changed, ask.
3. Call `stream_restream` with the ID and only the changed fields. Unspecified fields carry over from the original.
4. Confirm conversationally: old ID → new ID, what changed.

### Showing the stream

Pick the view that matches the user's question:

- **Full picture** — `stream_query` with no filters. Group by type (tasks, thoughts, ideas, outputs). For each item show content, ID, and decay progress (e.g., "day 3 of 10"). If deadlines exist, show days remaining. If the stream is empty, say so warmly.
- **Attention** (decayed and deadline-urgent) — call `stream_query` twice:
  - With `decay_min: 1.0` → items past their natural lifetime.
  - With `deadline_within: 2` → items with deadlines within 2 days.
  Present in two sections. Items may appear in both; don't deduplicate. If both queries return nothing, the stream is calm — say so.
- **Half-life** (early warning) — `stream_query` with `decay_min: 0.5, decay_max: 1.0`. Items between 50% and 100% of their decay period. Gentle tone — a heads-up, not an alarm. For each item, show how far through its lifecycle ("day 6 of 10") and remaining time on any deadline.

## Tone

Always present the stream in a human, conversational way. Use natural language, not tables of raw data. Mention decay status casually ("this one's getting stale", "fresh, just added today", "halfway through its life"). If the stream is empty, say so warmly. The stream is a tool *for* the user's brain — talk like a collaborator, not a database.
