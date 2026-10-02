---
name: stream
description: "Activates when the user discusses tasks, todos, productivity, their stream, what they need to do, what's on their mind, what they want or what stands in their way, or asks to add, restream, drop or review items — and their stream lives in Capacities."
user-invocable: false
---

# The Stream of Consciousness, in Capacities

The user keeps a personal productivity stream for an ADHD brain as native objects in their Capacities space. You reach it through the Capacities MCP tools (`search`, `listObjectsByObjectType`, `getObjectContent`, `getObjectTypeShape`, `createObjectViaMD`, `updateObjectViaMD`, `readObjectBlocks`, `addBlock`, `deleteObject`). The tools may carry a server prefix; use whichever Capacities server is connected.

If the space has no `Run`, `Drift`, `Wish` and `Obstacle` object types (`getObjectTypeShape` fails for them), the stream isn't set up yet — point the user to the `setup` skill.

## Philosophy

- Things don't get "done" — they **leave the stream** or get **restreamed** (re-encoded).
- **Decay** forces regular triage without guilt. Items naturally fade unless actively kept.
- **Re-encoding is the user's work.** The stream helps because the user re-perceives and rewrites what's in it. A rewrite done for them skips the part that matters.
- The system is intentionally minimal. Do not add tags, collections, or structure.

Always read the stream from Capacities — never reason about its state from memory.

## Two streams

### The fast stream — a week

Type doesn't classify what an item is *about* — it classifies what attention is **doing** with it.

| Type | In a word | What it is / defining test |
|------|-----------|----------------------------|
| `Run` | doing | There is a concrete action and the user is on it. *"Would I act on it today?"* Engagement, not intention. |
| `Drift` | wondering | Interesting, but ask "so what would you *do*?" and you'd shrug. Seeds, what-ifs, open questions, saved links. **Fading is success** — what matters resurfaces on its own. |

One question sorts anything: **is there a concrete action?** Yes → `Run`. No → `Drift`. When unsure, default to `Run`.

A run or drift decays 7 days after its **created date**, which is the date it entered the stream. Restreaming is the only thing that restarts the clock.

**Pull and muse are names, not types.** A restreamed run is a *pull* — an action the user keeps circling. A restreamed drift is a *muse* — a thought they keep returning to. You can see it in the item itself: its body opens with dated lines, one per earlier wording. They get no extra time: an item that keeps coming back is exactly the one to look at harder, with a technique from the deck.

### The slow stream — a month

| Type | In a word | What it is |
|------|-----------|------------|
| `Wish` | wanting | A state the user wants to be true. The title is a short handle to spot it by; the wish itself is one sentence in its `Description`. |
| `Obstacle` | blocking | What currently stands between the user and a wish. |

The slow stream works by **contrast**: a wish held against what stands in its way stays motivating. Three rules protect that:

- **No narration.** Never write out — or invite the user to write out — how the wish comes true, how it could fail, or the milestones along the way. Describing the outcome in detail relieves the tension that the contrast exists to create. One line of wish, one line of obstacle.
- **The main obstacle, not an inventory.** A wish wants the one to three obstacles that matter now. If the user starts listing everything that's missing, they're building a project plan; ask which single thing is most in the way.
- **Only while it's believable.** Contrast motivates when the user expects the wish can happen. An obstacle that makes the wish feel out of reach works against it.

A wish or obstacle decays 30 days after it was **last updated**.

### Links

An item may carry one link to what it serves, as an object property:

- a `Run` → the `Obstacle` it works on
- a `Drift` → the `Wish` it belongs to
- an `Obstacle` → its `Wish`

A run doesn't link straight to a wish, by design: asking *"which obstacle does this run move?"* is the useful question. If there's no answer, either the run isn't aimed at what's in the way, or there's an obstacle nobody has named yet. Leave the link empty rather than inventing an obstacle to hold it.

Links are optional. Setting one is a property update, not a restream.

### Testing a wish

Run a candidate wish through these. Failing one means reframe it, or it isn't a wish.

1. **A state, not a deliverable.** Is it still true the day after it happens? "Launch the product" is over in a day; "the product has people paying for it" holds.
2. **A want, not a should.** Does reading it pull? An obligation is a run.
3. **Believable.** Does the user expect it can happen? If not, shrink it until they do.
4. **Something is in the way.** Can they name the main obstacle now? If nothing is in the way, it's a run. If they can't say what is, it's a topic — keep it as a drift.
5. **One line.** No "and", no plan.

### Testing an obstacle

1. **If-then.** Can the user finish "If this shows up, then I will ___"? If no response exists, it's a condition of life, not an obstacle.
2. **A run exists.** Can they name one run that would chip at it this week?
3. **It can dissolve.** Would they know when it's gone?
4. **It leaves the wish believable.** After reading it, does the wish feel more reachable, or less? If less, narrow it to the part within reach: "can't compete with funded rivals" → "haven't found the wedge where funding doesn't matter".
5. **A present fact, not a need.** "No legal entity exists" is an obstacle; "need to register a legal entity" is a run.

A condition that fails 1 and 3 (a diagnosis, a chronic shortage) belongs in the wish's own wording as a constraint, not as an obstacle.

## How to interact

Users won't issue commands — they describe what they want, what they've done, or what's on their mind. *"What's in my stream?"* is a read; *"add a thought about Z"* / *"I'm worried about Q"* is an add; *"I wish…"* may be a wish; *"the thing stopping me is…"* an obstacle; *"forget about Y"* is a drop.

### Capture freely, re-encode never

**Adding needs no permission.** Add what the user mentions, right then, in their words — not a tidied paraphrase.

**Restreaming is different: the new wording must be the user's.**

- Restream when the user has said something that re-frames an item. Use what they said.
- When an item has decayed or keeps coming back and the user hasn't re-worded it, **don't write the rewrite for them.** Open `rewrite-deck.md` (next to this file), name a technique, ask its question, and restream what they answer.
- Never restream just to keep something alive. If nothing has changed in how the user sees it, it stays as it is or it leaves.

## Operations

Property keys differ between spaces. Before the first write to a type in a conversation, call `getObjectTypeShape` for it and use the keys it returns.

### Reading the stream

1. `listObjectsByObjectType` for `Run`, `Drift`, `Wish`, `Obstacle` — this returns IDs and titles.
2. `getObjectContent` on the items you need dates or links for. The stream is small by design; if a type has grown past a few dozen objects, read only what the question needs.
   Deleted things leave IDs behind that the app doesn't show: a link entry with an ID and no title, or a collection ID on an object. Treat the first as no link, ignore the second, and don't report either to the user as something to fix.
3. Work out decay yourself:
   - `Run` / `Drift`: days since `createdAt`, out of 7, counted in the user's timezone. A `createdAt` in the future means the item is upstream and not in the stream yet — leave it out unless the user asks what's coming.
   - `Wish` / `Obstacle`: days since `lastUpdated`, out of 30.
4. For a wish or obstacle, also say what the fast stream is doing for it: how many runs or drifts link to it, and how recent the newest is. One with nothing linked for weeks is still wanted but not being moved — worth saying out loud.

Present it as a person would: fast stream first, then each wish with its obstacles under it. "Day 3 of 7", "getting stale", "past its week" — not a table of raw fields.

Useful views: everything past its window; everything past half; anything with a deadline in the next two days; the pulls and muses.

### Adding an item

1. Decide the type (default `Run`), the title — one line, the user's words — and any body detail.
2. `createObjectViaMD` with that type and title. Set a deadline only for a hard external date, a future `createdAt` only for an upstream item (see below), and a link only when the user made the connection themselves or it's unmistakable. A link is written as `[[Exact Title Of The Target]]`.
3. Confirm briefly.

An obstacle is one line, no body. A wish is a short title plus the one-sentence wish in its `Description`, no body.

### Restreaming an item

The item is rewritten in place. It keeps its identity and its links; the wording it had stays in its body as a dated line, most recent first.

1. Find the item and read its current wording.
2. Take the new wording from the user. If it's the same as the old, there is nothing to restream.
3. `addBlock` with no `afterBlockId` — this inserts at the top of the body — containing today's date and the old title. If the body already has such lines, write the date the way they do; otherwise use `YYYY-MM-DD <old title>`. Any detail that belonged to the old wording stays under its line.
4. `updateObjectViaMD` to set the new `title`. For a run or drift, also set `createdAt` to now: that restarts its week. A wish or obstacle needs nothing more — the edit itself restarts its month.

For a wish, the wording that gets restreamed is its `Description`: the dated line carries the old description, and step 4 sets the new one. The title changes only if the user renames the handle.
5. Confirm: what it says now, and that its clock starts over.

When an item has come round several times, read the dated lines back to the user before asking for the next wording.

A run that turns back into a drift (or a drift that found its action) needs its type changed. These tools can't change an object's type — ask the user to change it in the app, then do the rest.

### Upstream items

A run or drift's created date is the date it enters the stream. An item with a created date in the future is upstream: it exists, but it hasn't entered, and it takes no attention until that day. Its week starts then.

To create one, set `createdAt` to the entry date at midday in the user's timezone, so the day can't shift when the date is stored.

A date can mean two different things, and only one belongs here:

- **Bring it into the stream then.** An upstream item. It lives here.
- **A commitment on that date** — something breaks, or someone is let down, if the date passes. That is a reminder, and it belongs in the user's calendar or task app. Say so rather than creating it as a stream item.

### Leaving the stream

- **Dropped** — the user is letting it go. `deleteObject` moves it to the trash, where it can be restored for 30 days. Do it without asking when the intent is clear.
- **Finished** — leave the object alone and say it's ready to leave. What a finished item turns into is the user's call and their gesture in the app: these tools can't change an object's type, and some users keep what leaves as a record rather than deleting it. Trash a finished item only when the user tells you that's what they do.

When an obstacle leaves, the wish is worth a glance: what's in the way now?

## Limits worth knowing

- Object types, properties and saved queries can't be created or changed through these tools.
- Creating objects counts against a per-user quota (5,000). The stream is far below that, but don't create probe or scratch objects.

## Tone

Present the stream in a human, conversational way. Mention decay casually ("this one's getting stale", "fresh, just added today", "halfway through its life"). If the stream is empty, say so warmly. The stream is a tool *for* the user's brain — talk like a collaborator, not a database.
