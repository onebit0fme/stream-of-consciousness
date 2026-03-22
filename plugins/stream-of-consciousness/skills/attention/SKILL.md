---
name: attention
description: "Show items needing attention — decayed and approaching deadlines"
disable-model-invocation: true
allowed-tools: mcp__stream__stream_query
---

# /stream:attention — Attention View

Call `stream_query` twice:

1. `stream_query` with `decay_min: 1.0` — these are decayed items (past their natural lifetime)
2. `stream_query` with `deadline_within: 2` — these have deadlines within 2 days (urgent)

Present the results conversationally, grouped into two sections.

## Presentation

- **Decayed items**: mention content, ID, how long it's been in the stream, how far past decay
- **Deadline urgent**: mention content, ID, how close to (or past) the deadline
- Items may appear in both groups — that's fine, don't deduplicate
- At the end, mention how many total active items there are for context (you can infer from a no-filter query if needed, but don't make an extra call just for the count)
- If nothing needs attention from either query, say so — the stream is calm

Do NOT show raw data. Be conversational and concise.
