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
| `stream_add` | Add a new item (content, type, startDate, deadline, hook) |
| `stream_resolve` | Resolve an item by ID |
| `stream_query` | Query items with filters (query, type, status, decay_min, decay_max, deadline_within) |
| `stream_restream` | Resolve an item and create a new version of it — a re-encoding |
| `stream_update` | Set an item's hook and/or deadline in place — no decay reset, no new version |

Always use these tools — never reason about the state of the stream from memory.

## Motion-states (the four types) and decay periods

Type doesn't classify what an item is *about* — it classifies what your attention is **doing** with it. William James saw thought as "flights and perchings": attention lands and rests on a **perch** (a stable thing you can point at — a conclusion, a definite item), then moves between landings in a **flight** (the pull, the transition — real mental activity, but hard to point at because it's a motion, not a thing). Cross perch-vs-flight with directed-vs-free and you get four motion-states, each with its own decay window.

| Type | In a word | Decay | What it is / defining test |
|------|-----------|-------|----------------------------|
| `live` | doing | 7 days | **Directed perch** — a foot is already down, you're working on it *now* (not planning to, *are*). *"Would I act on it today?"* Engagement, not intention. |
| `pull` | avoiding | 4 days | **Directed flight** — a known action you keep *not* starting. You know exactly what doing it looks like; the circling *is* the pull. *"I keep thinking about it but haven't started."* Shortest window by design: a pull should resolve or reveal fast. |
| `muse` | returning | 21 days | **Free perch** — no action exists, but you keep coming back to reread and sit with it because it keeps giving. *"There's nothing to *do* — I revisit it to chew on it."* Longest window: it's allowed to persist. |
| `drift` | wondering | 5 days | **Free flight** — interesting, but ask "so what would you *do*?" and you'd shrug. Novelty for its own sake (seeds, what-ifs, saved links). **Fading is success** — what matters resurfaces on its own; the rest is meant to fade, no guilt. |

Two questions sort anything: **(1) Is there a concrete action?** No → `drift` or `muse`. Yes → `live` or `pull`. Then **(2)** if no action, new-and-sparkly = `drift` / something you keep returning to = `muse`; if action, in motion = `live` / circling it = `pull`. When unsure, default to `live`.

## The hook — an item's engagement signal

Motion-state says what your attention is *doing* with an item. **Hook** answers a different, orthogonal question: *what could actually get you to engage it?* For an interest-based brain, importance alone doesn't move you — a task has to be compelling in some way or nothing happens. Hook names whether that compelling handle is present.

It's a **four-state signal, not a label.** The point is a fast triage read, never the chore of tagging everything — most items stay unset, and that's fine.

| Hook | Meaning | What it signals |
|------|---------|-----------------|
| *(unset)* | Not decided yet | Undecided — assign only when it's worth it; **never nag** |
| `interest` | Has an in-the-moment hook — interesting, challenging, or novel *right now* | Healthy, the typical good case |
| `passion` | Tied to something deeper and lasting — values, identity, a bigger vision | **Where to focus** — the most durable engagement; protect these |
| `none` | Explicitly no hook | **At risk** — needs a hook, or should be dropped |

`none` is the most useful state: it flags an item that will stall no matter how important it is. `passion` is where the user's real energy lives. Unset just means "not triaged" — don't force a value onto everything. **Unset ≠ `none`:** unset is "haven't looked"; `none` is "looked, found no handle" — opposite ends, never interchangeable. A common trap: reading `hook: none` as "no hook set." It's the reverse — `none` is a *deliberately assigned* value meaning the item was triaged and came up empty; an unset item shows no `hook:` field at all.

The tools report the raw state and nothing more — `stream_query` prints `hook: interest` / `hook: passion` / `hook: none` for set items and omits the field entirely for unset ones. **The interpretation is yours to do:** when scanning a result, pick out the `none` items yourself — those are the at-risk, hook-it-or-drop-it ones — and surface them during triage so the diagnosis doesn't get missed. Don't expect the tool to flag them.

### Where this comes from (Dr. William Dodson)

Dodson's model of the ADHD **interest-based nervous system**: neurotypical brains run on an *importance-based* nervous system — moved by obligations, deadlines, rewards, consequences. An interest-based nervous system needs the task itself to be compelling — you must be **interested, challenged, find it novel, feel it's urgent, or connect it to a passion** — or it's "not now." This isn't a willpower failure; it's a different set of rules. His question to clients: *"If you could get engaged, is there anything you couldn't do?"* — most answer no.

The motivators (the **INCUP** set), and how each works:

- **Interest** — attention follows fascination, not importance. Genuinely interesting tasks initiate and sustain themselves (even into hyperfocus); dull ones feel impossible to start.
- **Novelty** — a new approach, tool, or environment can renew energy for a non-preferred task. Novelty is time-limited by nature — which is exactly why **The Restream Rewrite Deck** exists: rotate techniques so a stale item feels fresh again.
- **Challenge** — a right-sized challenge delivers a dopamine hit (beat the timer, beat yesterday's score). Too much overwhelms; and once conquered it stops being a challenge, so it has to keep stretching.
- **Urgency** — a deadline *tonight* motivates; one three weeks out carries no weight. **In the stream, urgency is not a hook** — it's carried by `deadline` and `decay`. That's why the hook axis deliberately leaves it out.
- **Passion** — interest's deeper, more durable cousin. Interest asks *"is this stimulating?"*; passion asks *"does this matter to me?"* Route a dull-but-important task through a value it serves (paying a bill → the financial independence you actually want). Passion is the strongest and most lasting motivator when it's genuinely there — but it can't be manufactured on demand the way urgency can. Notice the user's *existing* passions and route items through them; don't try to conjure one.

### Helping assign a hook

On request, help the user set an item's hook — but stay opt-in and low-friction (labelling everything is the burden this four-state design exists to avoid):

- Surface it when an item is **stalling** — a `pull` that won't start is precisely where naming the missing handle is the intervention: *"what's the hook here — is any part of this interesting, or is it `none` and we should drop it?"*
- To find the hook, walk the motivators: is any part of it interesting or novel *now*? Could it be framed as a challenge? Does it connect to something the user genuinely cares about (→ `passion`)? If nothing lands, it's `none`.
- Flag **`none`** items as at-risk during triage — hook them or drop them (dropping is a clean leave, not a failure).
- Point attention at **`passion`** items — that's where sustained energy is; protect them from being crowded out.
- Set or change a hook with **`stream_update`**, never a restream — a hook change is not a re-encoding and must not reset decay.

## How to interact

Users won't issue commands or specify operations — they describe what they want, what they've done, or what's on their mind. Translate their intent into the right tool call and act. *"What's in my stream?"* / *"show me what I'm working on"* is a query; *"I finished X"* / *"cancel Y"* is a resolve; *"add a thought about Z"* / *"I'm worried about Q"* is an add; new context on an existing item is a restream. There's no command syntax to wait for.

### Flow with the stream

The stream is the source of truth — not your context window. Flow with it in real time:

- When something is done → `stream_resolve` it immediately.
- When something new comes up → `stream_add` it immediately.
- When something changes → `stream_restream` it (resolves the old, creates a new version).
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

**Update ≠ restream.** Setting a hook or nudging a deadline is a `stream_update` — it changes metadata, not meaning, so it must *not* reset decay or create a new version. Only restream when the item's content or type genuinely changed.

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
   - **hook** — usually leave unset at capture. Only set it if the user clearly signals the intrinsic motivation (or its absence). See "The hook" above.
2. If genuinely ambiguous (can't determine content, type clearly wrong), ask. Don't guess wildly.
3. Call `stream_add`.
4. Confirm what was added in a brief, conversational way.

Example parsings (note how type follows the *motion*, not the subject):
- "review the Q1 budget proposal, deadline March 5" → type=live, content="Review the Q1 budget proposal", deadline=2026-03-05 (you're working on it)
- "I keep meaning to message Saeed about the collab" → type=pull, content="Message Saeed about the collab" (the action is obvious — send the message — you just keep not)
- "I keep coming back to that idea that trajectory is field-determined" → type=muse, content="Trajectory is field-determined" (nothing to *do* with it; you revisit it because it keeps giving)
- "finish the API docs by Friday" → type=live, content="Finish the API docs", deadline=(next Friday)
- "random thought: what if I learned to sail someday" → type=drift, content="Learn to sail someday" (idle wondering, no obligation)
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
2. Determine what changed: new content, new type, new deadline, new startDate. If the user didn't say what changed, ask. **At least one field must actually change** — a restream that would recreate the item as-is is rejected (the tool replies "nothing changed"). If nothing has genuinely changed, don't restream: leave it, or if it's done, resolve it instead. And make the change a real **re-encoding**, not a cosmetic tweak — the point of restream is to re-*perceive* the item, not relabel it. If you're unsure how to rewrite it, pull a technique from **The Restream Rewrite Deck** below and run it with the user.
3. Call `stream_restream` with the ID and only the changed fields. Unspecified fields carry over from the original. To **remove** a deadline, pass `deadline: null` (omitting it keeps the existing one).
4. Confirm conversationally: old ID → new ID, what changed.

### Updating a hook or deadline (no restream)

Some changes aren't re-encodings and must not reset decay: setting or changing an item's **hook**, or adjusting a **deadline** (a date slipped, a new hard date appeared). Use `stream_update` for these — it patches the item in place, no decay reset. Reserve `stream_restream` for genuine content/type re-encodings. Rule of thumb: if the *meaning* of the item didn't change, it's an update, not a restream.

### Showing the stream

Pick the view that matches the user's question:

- **Full picture** — `stream_query` with no filters. Group by motion-state (live, pull, muse, drift). For each item show content, ID, and decay progress (e.g., "day 3 of 7"). If deadlines exist, show days remaining. If the stream is empty, say so warmly.
- **Attention** (decayed and deadline-urgent) — call `stream_query` twice:
  - With `decay_min: 1.0` → items past their natural lifetime.
  - With `deadline_within: 2` → items with deadlines within 2 days.
  Present in two sections. Items may appear in both; don't deduplicate. If both queries return nothing, the stream is calm — say so.
- **Half-life** (early warning) — `stream_query` with `decay_min: 0.5, decay_max: 1.0`. Items between 50% and 100% of their decay period. Gentle tone — a heads-up, not an alarm. For each item, show how far through its lifecycle ("day 5 of 7") and remaining time on any deadline.

## The Restream Rewrite Deck

Restream exists to force **cognitive re-encoding** — its job is to make the user *re-perceive* the item, not just to log that it came back. Re-reading an unchanged summary produces semantic satiation: you register the label, not the thing under it. That's why an as-is restream is refused (see "Restreaming an item" above) — merely noting that something resurfaced, with no re-thinking, is the illusion of attention while the item slips through the decay guard untouched. That silent bypass is the exact failure the stream is built to prevent.

So when an item resurfaces and earns a restream, don't just touch it — **rewrite it**. Below are twelve rewrite techniques. Pick the one that fits the item (each lists what it's **best for**), run it *with* the user — draw the card, ask the question, do the deletion — and restream whatever it dislodges. Recommend a technique by name; the user built this deck deliberately.

*Running example used throughout:* "Figure out what to do about the apartment situation" — a pull, restreamed twice with the wording unchanged both times (the failure this deck fixes).

### 1. Defamiliarization
**Mechanism:** Repeated exposure to your own phrasing produces semantic satiation — you re-read the label, not the thing. Describing the item as if you'd never encountered it forces re-perception of the situation, not the words.
**Run it:** (1) Ban every noun and shorthand from the current summary. (2) Describe the situation to an intelligent alien: what is physically happening, who is involved, what changes if nothing is done. (3) Write the new summary from that description.
**Best for:** Items you keep circling — restreamed again and again with no movement — and anything you've gone word-blind to.
**Example:** "The apartment situation" becomes *"A contract I signed expires in four months. The person who owns the space I sleep in wants more money. I have not answered their message in three weeks."* — suddenly it's about an unanswered message, not an abstract "situation."

### 2. Register Shift
**Origin:** Raymond Queneau, *Exercises in Style* — the same trivial story told 99 ways; every genre smuggles in its own assumptions.
**Mechanism:** Genres carry hidden frames — a bug report assumes an expected-vs-actual gap; a complaint assumes a responsible party. Translating the item into a foreign register imports that register's questions, which your default framing never asks.
**Run it:** Rewrite the item as one of — **bug report** (expected / actual / steps to reproduce) · **headline** (one line, active verb, no hedging) · **telegram** (every word costs money) · **complaint letter** (to whom, about what, demanding what remedy) · **changelog** (what changed since the last version — native to restreaming, brutal on no-ops) · **postmortem** (assume it already failed; what killed it) · **obituary** (cause of death, survived by, what it never got to do) · **want ad** (what you're seeking, what you'll pay or trade) · **product review** (stars, pros, cons, verdict: renew or return) · **weather forecast** (the situation with your agency removed — noticing you wrote yourself out of the system is the insight).
**Best for:** Vague pulls; items where you suspect you're avoiding naming the real issue.
**Example (bug report):** *Expected: I renegotiate or move by March. Actual: I refresh listing sites and close the tab. Reproduce: open the landlord's message, feel dread, switch apps.* — the bug is the dread, not the market.

### 3. Oblique Constraint
**Origin:** Brian Eno & Peter Schmidt, *Oblique Strategies* — a deck of cryptic studio prompts for breaking creative deadlock.
**Mechanism:** Stuck thinking is grooved thinking — the same entry point leads to the same dead end. A random, irrelevant constraint forces entry from an angle the groove doesn't cover; the irrelevance is the feature (a relevant prompt would just re-run the groove).
**Run it:** (1) Draw a random prompt (roll a die, or ask Claude to draw): *"What would this look like if it were easy?" · "Honor thy error as a hidden intention." · "What is the simplest thing that could possibly move?" · "What would you advise your enemy to do?"* (2) Answer it in a sentence or two about the item — no skipping the card. (3) Restream whatever it dislodged.
**Best for:** Anything stuck past half-life; items where every conscious approach has been tried.
**Example:** Card *"What would this look like if it were easy?"* → *"I'd send one message today asking for renewal terms and book two viewings as a fallback."* That sentence is a live item; the pull dissolves into it.

### 4. Cut-Up
**Origin:** William S. Burroughs (via Brion Gysin), later Bowie's lyric method — physically cutting and rearranging text to produce accidental juxtapositions.
**Mechanism:** Syntax preserves your existing logic. Destroying sentence order destroys the argument embedded in it, and the accidents of recombination suggest connections deliberate thought filters out.
**Run it:** (1) Take the item's full content (summary + details). (2) Split into fragments (phrases, not sentences). (3) Shuffle; read three random pairings. (4) For each, ask: if this juxtaposition were meaningful, what would it mean?
**Best for:** Items with long, accreted detail sections; drifts that have collected many angles without converging.
**Example:** "three weeks no reply" + "fallback viewings" collide into: the silence *is* the fallback strategy — you're passively letting the lease lapse. Now decide if that's the plan on purpose.

### 5. Via Negativa
**Origin:** Apophatic theology — defining the divine only by what it is not; adopted in decision-making (Taleb) as subtractive knowledge, since what to avoid is more knowable than what to pursue.
**Mechanism:** Positive definitions of fuzzy things stay fuzzy. Negation is cheap and precise — each "this is not X" carves away a possibility, and the residue after several cuts is the actual shape of the concern.
**Run it:** Write five sentences starting "This item is not about…" — at least two must be surprising. Then one sentence on what survives.
**Best for:** Scoping bloated items; items that feel important but resist summary.
**Example:** *Not about money (I can afford the increase). Not the neighborhood. Not the landlord. Not urgent for four months. Not really about this apartment.* Survivor: *it's about whether I'm staying in this city* — a different, and much bigger, question.

### 6. Inversion
**Origin:** Carl Jacobi's maxim "man muss immer umkehren" (invert, always invert), popularized by Charlie Munger.
**Mechanism:** The mind generates failure modes better than success paths. Writing the plan that *guarantees* the bad outcome produces a concrete list — and it usually reads as a diary of current behavior, converting vague unease into named, reversible actions.
**Run it:** Write "How to guarantee this goes as badly as possible" in 3–5 steps. Then mark each step you're currently executing.
**Best for:** Anything with a deadline; items carrying anxiety without a plan.
**Example:** *Guarantee disaster: don't reply until the deadline; do zero market research; tell no one; decide in a panic in the final week.* Currently executing steps 1, 2, and 3. The restream writes itself.

### 7. Bisociation
**Origin:** Arthur Koestler, *The Act of Creation* — creativity as the collision of two previously unconnected frames of reference.
**Mechanism:** Stream items are filed as unrelated by default. Forcing a connection between two arbitrary items recruits associative machinery that single-item focus never activates; occasionally two worries turn out to be one worry wearing two coats.
**Run it:** (1) Pull one random *other* item from the stream. (2) Finish the sentence "These are the same problem because…" — however absurd. (3) Keep it only if it earns its place; the exercise pays even when the answer is discarded.
**Best for:** Weekly reviews; when the stream feels like scattered noise; drifts.
**Example:** Collide "apartment situation" with a pull about "keep skipping the gym": *same problem because both are renewals I'm letting lapse by default instead of deciding* — a pattern-level insight neither item held alone.

### 8. Incubation (Deliberate Not-Working)
**Origin:** Poincaré's walks, Dalí's hypnagogic naps; formalized as the incubation effect (Wallas's four-stage model).
**Mechanism:** Unconscious processing continues after conscious work stops, and evidence suggests it's genuine unconscious work, not just rest (Gilhooly, 2016); breaks filled with *unrelated* activity outperform related activity (Ellwood, 2009). Crucially, incubated solutions often fail to surface without a retrieval trigger (Nam, 2015) — the answer exists below the waterline and needs prompting.
**Run it:** (1) Read the item slowly; pose one sharp question about it in writing. (2) Do *not* attempt an answer. Close it; do something unrelated. (3) When it next resurfaces (its decay window brings it back), answer the question first thing, before re-reading the details.
**Best for:** Genuinely hard decisions; problems where forcing has failed repeatedly.
**Example:** Question posed Monday: *"What would I need to know to decide in 10 minutes?"* On resurface Thursday the answer arrives pre-formed: *the renewal price and whether my job is remote next year* — two concrete look-ups replace one amorphous dread.
**Note:** Waiting isn't procrastination if a question was planted before the wait began. Unplanted waiting is just decay.

### 9. Negative-Space Carving
**Origin:** Sculpture — the figure is revealed by removing everything that isn't it; as an editing discipline, writing by deletion only.
**Mechanism:** Addition is easy and dilutive; deletion forces a value judgment on every word. What refuses to be cut under pressure is, by revealed preference, the core of the item.
**Run it:** Restream by deletion only — cut the item's content by half. Adding, rephrasing, and reordering are all forbidden. Whatever survives is the new summary.
**Best for:** Bloated items; detail sections that have become archives; pre-resolution cleanup.
**Example:** Forty words of lease dates, message history, and market links reduce to *"Reply to landlord. Decide: this city or not."* Everything else was scaffolding.

### 10. Cause & Insight Language
**Origin:** Expressive-writing studies (Klein & Boals, 2001; Yogo et al., 2008) — writing about stressors raised working-memory capacity weeks later, and the gains tracked the use of *cause and insight words* ("because," "realize," "understand"), not emotional venting.
**Run it:** When restreaming, answer "why is this here?" and "what causes this?" at least once. A restream containing a genuine *because* buys measurable cognitive relief; a verbatim restream buys none.
**Best for:** Every restream — this is the single highest-leverage habit in the deck.
**Example:** *"Still haven't replied to the landlord — because any reply commits me to a decision I haven't made about staying in this city."* One *because* converts a nag into a diagnosis.

### 11. Distanced Rewrite (Third Person)
**Origin:** Self-distancing research (Kross, 2016; Orvell et al., 2020; Guo 2022 meta-analysis) — reflecting on experiences in third person or by name reduces emotional reactivity across intensity levels at almost no cognitive cost, strongest when externalized through writing.
**Run it:** Rewrite the item about a character with the user's name, then answer as an outside advisor would: "What is [Name]'s actual problem? What would you tell [Name] to do?"
**Best for:** Emotionally loaded items; anything the user flinches from opening. Pairs naturally with defamiliarization and register shift.
**Example:** *"Alex has been avoiding the landlord's message for three weeks. Alex can afford the increase but hasn't decided whether to stay in the city. Alex should decouple the two: reply asking for terms now, decide about the city separately."* — advice you'd give a friend in one pass, and couldn't give yourself in three weeks.

### 12. Affect Labeling
**Origin:** Lieberman et al. (2007, 2011) — naming an emotion dampens amygdala response comparably to deliberate regulation strategies, and it works even though people consistently predict it won't. It's *incidental* regulation: the payoff is a side effect, never a goal you feel yourself pursuing.
**Run it:** Add one clause naming the feeling attached to the item, as plain metadata: *"…and the feeling is ___."* Do it mechanically. Don't expect it to feel like it's working — the research says it works anyway.
**Best for:** Any item that produces a flinch, dread, or avoidance on resurface.
**Example:** *"Reply to landlord — and the feeling is dread of confrontation."* Nothing else changes, and that's the point.

## Tone

Always present the stream in a human, conversational way. Use natural language, not tables of raw data. Mention decay status casually ("this one's getting stale", "fresh, just added today", "halfway through its life"). If the stream is empty, say so warmly. The stream is a tool *for* the user's brain — talk like a collaborator, not a database.
