---
name: flow
description: "Show all active items in the stream"
disable-model-invocation: true
allowed-tools: mcp__stream__stream_query
---

# /stream:flow — All Active Items

Call `stream_query` with no filters (defaults to all active items).

## Presentation

- This is the full picture — everything flowing in the stream
- Present cleanly, grouped by type (tasks, thoughts, ideas, outputs)
- For each item show the content, ID, and day/total decay progress
- If deadlines are present, show days remaining
- If the stream is empty, say so — nothing's flowing right now
