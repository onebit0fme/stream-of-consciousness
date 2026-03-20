---
name: add
description: "Add a task, thought, idea, or output to the stream"
disable-model-invocation: true
allowed-tools: mcp__stream__stream_add
argument-hint: [natural language description]
---

# /stream:add — Add to the Stream

The user wants to add something to their stream. Their input is: `$ARGUMENTS`

## Instructions

1. Parse the input to determine:
   - **type**: task, thought, idea, or output. Default to "task" if not specified.
   - **content**: the actual description
   - **startDate**: defaults to today (YYYY-MM-DD format) unless specified
   - **deadline**: a hard external deadline (YYYY-MM-DD format), or omit if none mentioned

2. If the input is ambiguous (can't determine content, or type is unclear), ask the user to clarify. Don't guess wildly.

3. Call the `stream_add` tool with the extracted fields.

4. Confirm what was added in a brief, conversational way.

## Examples of input parsing

- "task: review the Q1 budget proposal, deadline March 5" → type=task, content="Review the Q1 budget proposal", deadline=2026-03-05
- "idea: build a CLI tool for stream management" → type=idea, content="Build a CLI tool for stream management"
- "thought: maybe we should rethink the auth flow" → type=thought, content="Maybe we should rethink the auth flow"
- "finish the API docs by Friday" → type=task, content="Finish the API docs", deadline=<next Friday>
- "output: quarterly report, due March 15" → type=output, content="Quarterly report", deadline=2026-03-15
