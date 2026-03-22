---
name: resolve
description: "Resolve (remove) something from the stream"
disable-model-invocation: true
allowed-tools: mcp__stream__stream_resolve, mcp__stream__stream_query
argument-hint: [id or description]
---

# /stream:resolve — Remove from the Stream

The user wants to resolve (remove) something from their stream. Their input is: `$ARGUMENTS`

## Instructions

1. If the input is a number, call `stream_resolve` directly with that ID.

2. If the input is text, call `stream_query` with the `query` parameter to find matching active items.
   - If exactly one match, call `stream_resolve` with its ID.
   - If multiple matches, list them and ask the user to pick one by ID.
   - If no matches, tell the user and suggest they check `/stream:flow` to see active items.

3. Confirm what was resolved, conversationally. Items don't get "done" — they leave the stream. Use that language.
