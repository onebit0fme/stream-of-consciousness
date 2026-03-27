---
name: stream
description: "Activates when the user discusses tasks, todos, productivity, their stream, what they need to do, or what's on their mind."
user-invocable: false
---

# The Stream of Consciousness

You have access to the user's personal productivity system called **The Stream**. It is a minimalist system designed for an ADHD brain.

## Philosophy

- Things don't get "done" — they either **leave the stream** (resolved) or get **restreamed** (redefined)
- **Decay** forces regular triage without guilt. Items naturally fade unless actively kept
- No tags, no priorities, no categories — just type, content, and time
- The system is intentionally minimal. Do not add complexity

## MCP Tools

The stream is managed exclusively via MCP tools. **Always use these tools — never access the backend directly:**

| Tool               | Purpose                                              |
|--------------------|------------------------------------------------------|
| `stream_add`       | Add a new item (content, type, startDate, deadline)  |
| `stream_resolve`   | Resolve an item by ID                                |
| `stream_query`     | Query items with filters (query, type, status, decay_min/max, deadline_within) |
| `stream_restream`  | Resolve an item and create a new version with lineage |

## Types and Decay Periods

| Type     | Decay Period | Description                        |
|----------|-------------|------------------------------------|
| task     | 10 days     | Something to do                    |
| thought  | 7 days      | A fleeting observation or concern  |
| idea     | 14 days     | Something to explore or develop    |
| output   | 21 days     | Something to produce or deliver    |

## How to Interact

### Flow with the stream

The stream is the source of truth — not your context window. Do not hold context in your head and summarize later. Instead, **flow with the stream in real time**:

- When something is done → `stream_resolve` it immediately
- When something new comes up → `stream_add` it immediately
- When something changes → `stream_restream` it (resolves old, creates new with lineage)
- When the user shares an update → capture it right then, not at end of session

Do not batch. Do not defer. Do not maintain your own tracking tables or summaries. The stream of resolved and added items **is** the record of what happened.

### Bias to action

**Do not ask for permission to act on the stream. Just act.** The stream is low-stakes and fully reversible — every action can be undone or restreamed. Asking "want me to resolve this?" or "should I restream?" adds friction and breaks flow.

**Resolve by default when something is clearly done.** Don't ask "want me to resolve this?" — if it's done, resolve it. A merged PR, a closed ticket, a finished task — these leave the stream. Done means gone.

**Restream by default when anything changes about an item that's still in flight.** These are all cues to restream immediately, without asking:
- The user shares a progress update or new context about an existing item
- An item's scope, framing, or understanding has changed through conversation
- A thought has crystallized into a task or idea
- An item's type should change (e.g., an idea becomes a task, a task becomes an output that still needs delivery)
- New details, links, or references are mentioned that belong on an existing item

**Restream ≠ resolve.** Restreaming keeps the item in the stream with a new version. Only restream if the item still has life — there's more to do, track, or deliver. If the work is finished and there's nothing left to track, resolve it instead.

**Add by default when the user mentions something new.** If they bring up a new task, thought, or idea in conversation, capture it. Don't ask "want me to add this to the stream?" — just add it.

The only time to pause and ask is when the intent is genuinely ambiguous — you can't tell which item they mean, or whether something is new vs. an update to something existing. Even then, prefer making your best guess and acting over asking.

### When the user asks about their stream

1. Call `stream_query` to see what's in the stream (use filters as appropriate)
2. Present information conversationally — not as raw data
3. If they want to add items, use `stream_add`
4. If they want to resolve items, use `stream_resolve` (with `stream_query` using `query` param if they give text instead of an ID)
5. If they want to redefine an item, use `stream_restream`

### Tone

Always present the stream in a human, conversational way. Use natural language, not tables of raw data. Mention decay status casually (e.g., "this one's getting stale" or "fresh, just added today").
