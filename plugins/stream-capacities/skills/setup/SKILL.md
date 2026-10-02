---
name: setup
description: "One-time setup of the Stream of Consciousness in a Capacities space: walks the user through creating the Run, Drift, Wish and Obstacle object types and checks the result. Use when the user asks to set up or install the stream in Capacities, or when the stream skill finds the object types missing."
---

# Set up the stream in Capacities

Object types and their properties can only be created in the Capacities app — the MCP tools can read a type's shape but not create or change one. So the user builds the types by hand, and you check their work.

## 1. See what's already there

Call `getObjectTypeShape` for each of `Run`, `Drift`, `Wish`, `Obstacle`. A type that errors doesn't exist yet. For one that exists, compare its properties with the table below and list only what's missing. If everything is there, say so and stop.

## 2. Walk the user through what's missing

Give the steps for one type at a time and wait for the user between types. In Capacities: **Settings → Object types → New object type**, then add properties from the type's settings.

Create the slow-stream types first, because the others link to them.

| Type | Property | Kind | Notes |
|------|----------|------|-------|
| `Wish` | `Description` | Text | The wish itself, one sentence. The title is a short handle for it. |
| `Obstacle` | `Wish` | Object, limited to `Wish` | The wish it stands in the way of. |
| `Run` | `Obstacle` | Object, limited to `Obstacle` | The obstacle it works on. Optional per item. |
| `Run` | `Deadline` | Date | Hard external dates only. |
| `Drift` | `Wish` | Object, limited to `Wish` | The wish it belongs to. Optional per item. |
| `Drift` | `Deadline` | Date | |

No date property is needed for when an item enters the stream: that is its created date, which Capacities fills in and which can be edited to a future day for something that shouldn't be in view yet.

Recommend turning on **two-way linking** for the three object properties, so a wish lists its obstacles and drifts and an obstacle lists its runs. That is what makes "is anything moving this wish?" answerable at a glance.

Don't suggest tags, collections, or extra properties. The stream is deliberately minimal.

## 3. Verify

Call `getObjectTypeShape` for all four types again. Confirm each property exists with the right kind and the right target type, and report anything off by name. Don't create test objects to check — reading the shapes is enough.

## 4. Suggest the views

Saved queries are also made by hand. Three are worth having:

- **Downstream** — runs and drifts created on or before today, oldest first: what has been in the stream longest and is due a decision.
- **Upstream** — runs and drifts with a created date in the future: what is on its way in.
- **Slow stream** — wishes and obstacles ordered by last updated, oldest first.

Then tell the user the stream is ready: they can describe what's on their mind and you'll take it from there.
