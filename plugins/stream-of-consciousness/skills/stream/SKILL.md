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
- No manual tags or categories — just type, content, and time.
- The system is intentionally minimal. Do not add complexity.

## MCP tools available

| Tool | Purpose |
|------|---------|
| `stream_add` | Add a new item (content, type, startDate, deadline) |
| `stream_resolve` | Resolve an item by ID |
| `stream_query` | Query items with filters (query, type, status, decay_min, decay_max, deadline_within) |
| `stream_restream` | Resolve an item and create a new version with lineage |

Always use these tools — never reason about the state of the stream from memory.

## Motion-states (the four types) and decay periods

Type doesn't classify what an item is *about* — it classifies what your attention is **doing** with it. William James saw thought as "flights and perchings": attention lands and rests on a **perch** (a stable thing you can point at — a conclusion, a definite item), then moves between landings in a **flight** (the pull, the transition — real mental activity, but hard to point at because it's a motion, not a thing). Cross perch-vs-flight with directed-vs-free and you get four motion-states. Each maps to a Todoist priority flag and has its own decay window.

| Type | Flag | In a word | Decay | What it is / defining test |
|------|------|-----------|-------|----------------------------|
| `live` | P1 | doing | 7 days | **Directed perch** — a foot is already down, you're working on it *now* (not planning to, *are*). *"Would I act on it today?"* Engagement, not intention. |
| `pull` | P2 | avoiding | 4 days | **Directed flight** — a known action you keep *not* starting. You know exactly what doing it looks like; the circling *is* the pull. *"I keep thinking about it but haven't started."* Shortest window by design: a pull should resolve or reveal fast. |
| `muse` | P3 | returning | 21 days | **Free perch** — no action exists, but you keep coming back to reread and sit with it because it keeps giving. *"There's nothing to *do* — I revisit it to chew on it."* Longest window: it's allowed to persist. |
| `drift` | P4 | wondering | 5 days | **Free flight** — interesting, but ask "so what would you *do*?" and you'd shrug. Novelty for its own sake (seeds, what-ifs, saved links). **Fading is success** — what matters resurfaces on its own; the rest is meant to fade, no guilt. |

Two questions sort anything: **(1) Is there a concrete action?** No → `drift` or `muse`. Yes → `live` or `pull`. Then **(2)** if no action, new-and-sparkly = `drift` / something you keep returning to = `muse`; if action, in motion = `live` / circling it = `pull`. When unsure, default to `live`.

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
  - A pull has crystallized into something you're now actually doing (pull → live).
  - An item's motion-state should change (e.g., a pull you've stopped acting on but keep returning to becomes a muse; a muse you've finally found an action for becomes a pull or live).
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

This applies to all four motion-states — live, pull, muse, and drift alike.

## Common operations

### Adding an item

1. Parse the user's input for:
   - **type** — the motion-state: `live`, `pull`, `muse`, or `drift` (default to `live` if not clear). Classify by what your attention is *doing*, not what it's about: working on it → `live`; a known action you keep avoiding → `pull`; no action but you keep returning to it → `muse`; idle wondering → `drift`.
   - **content** — what the item is. Follow the "Writing content" guidance above — use summary + details when there's enough substance to warrant it.
   - **startDate** — `YYYY-MM-DD`, defaults to today unless they specify a future start.
   - **deadline** — `YYYY-MM-DD` only if there's a hard external deadline.
2. If genuinely ambiguous (can't determine content, type clearly wrong), ask. Don't guess wildly.
3. Call `stream_add`.
4. Confirm what was added in a brief, conversational way.

Example parsings (note how type follows the *motion*, not the subject):
- "review the Q1 budget proposal, deadline March 5" → type=live, content="Review the Q1 budget proposal", deadline=2026-03-05 (you're working on it)
- "I keep meaning to message Saeed about the collab" → type=pull, content="Message Saeed about the collab" (the action is obvious — send the message — you just keep not)
- "I keep coming back to that idea that trajectory is field-determined" → type=muse, content="Trajectory is field-determined" (nothing to *do* with it; you revisit it because it keeps giving)
- "finish the API docs by Friday" → type=live, content="Finish the API docs", deadline=(next Friday)
- "random thought: what if the stream had a heat-based decay someday" → type=drift, content="What if the stream had heat-based decay" (idle wondering, no obligation)
- "a CLI for the stream so I can add things without opening Claude. Probably Rust. Could lift the existing TypeScript types via JSON schema." → type=pull, content="CLI for the stream so I can add items without opening Claude\n\nProbably Rust. Could lift the existing TypeScript types via JSON schema."

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
2. Determine what changed: new content, new type, new deadline, new startDate. If the user didn't say what changed, ask. **At least one field must actually change** — a restream that would recreate the item as-is is rejected (the tool replies "nothing changed"). If nothing has genuinely changed, don't restream: leave it, or if it's done, resolve it instead.
3. Call `stream_restream` with the ID and only the changed fields. Unspecified fields carry over from the original. To **remove** a deadline, pass `deadline: null` (omitting it keeps the existing one).
4. Confirm conversationally: old ID → new ID, what changed.

### Showing the stream

Pick the view that matches the user's question:

- **Full picture** — `stream_query` with no filters. Group by motion-state (live, pull, muse, drift). For each item show content, ID, and decay progress (e.g., "day 3 of 7"). If deadlines exist, show days remaining. If the stream is empty, say so warmly.
- **Attention** (decayed and deadline-urgent) — call `stream_query` twice:
  - With `decay_min: 1.0` → items past their natural lifetime.
  - With `deadline_within: 2` → items with deadlines within 2 days.
  Present in two sections. Items may appear in both; don't deduplicate. If both queries return nothing, the stream is calm — say so.
- **Half-life** (early warning) — `stream_query` with `decay_min: 0.5, decay_max: 1.0`. Items between 50% and 100% of their decay period. Gentle tone — a heads-up, not an alarm. For each item, show how far through its lifecycle ("day 5 of 7") and remaining time on any deadline.

## Tone

Always present the stream in a human, conversational way. Use natural language, not tables of raw data. Mention decay status casually ("this one's getting stale", "fresh, just added today", "halfway through its life"). If the stream is empty, say so warmly. The stream is a tool *for* the user's brain — talk like a collaborator, not a database.
