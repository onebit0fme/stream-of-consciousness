---
name: halflife
description: "Early warning — items approaching their half-life"
disable-model-invocation: true
allowed-tools: mcp__stream__stream_query
---

# /stream:halflife — Early Warning View

Call `stream_query` with `decay_min: 0.5` and `decay_max: 1.0` to get items between 50% and 100% of their decay period.

## Presentation

- These items aren't urgent yet, but they're drifting toward decay. The tone should be gentle — a heads-up, not an alarm.
- For each item show its content, ID, and how far through its lifecycle it is (e.g., "Day 6 of 10")
- For items with deadlines: how much time remains
- If nothing is at half-life, the stream is flowing smoothly — say so
