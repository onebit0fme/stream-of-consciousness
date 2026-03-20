---
name: restream
description: "Restream an item — resolve it and create a new version with changes"
disable-model-invocation: true
allowed-tools: mcp__stream__stream_restream, mcp__stream__stream_query
argument-hint: [id or description] [changes]
---

# /stream:restream — Restream an Item

The user wants to restream (redefine) something in their stream. Their input is: `$ARGUMENTS`

## Instructions

1. **Find the item:**
   - If the input starts with a number, that's the item ID.
   - If the input is text, call `stream_query` with the `query` parameter to find matching active items.
     - If exactly one match, use its ID.
     - If multiple matches, list them and ask the user to pick one by ID.
     - If no matches, tell the user and suggest they check `/stream:flow`.

2. **Determine what changed:** Parse the user's input for any of these:
   - New content (the description changed)
   - New type (task/thought/idea/output)
   - New deadline
   - If no changes are specified, ask what they want to change.

3. **Call `stream_restream`** with the item ID and any changed fields. Fields not specified will carry over from the original item.

4. **Confirm** what was restreamed conversationally — mention the old ID, new ID, and what changed.
