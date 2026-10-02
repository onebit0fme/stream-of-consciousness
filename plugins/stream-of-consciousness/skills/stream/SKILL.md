---
name: stream
description: "Activates when the user discusses tasks, todos, productivity, their stream, what they need to do, what's on their mind, or asks to add/resolve/restream/query items. Use this whenever the conversation touches what the user is working on, what they're worried about, or what they need to capture or track."
user-invocable: false
---

# The Stream of Consciousness

The user has the Stream of Consciousness MCP server installed. It exposes a personal productivity stream for an ADHD brain.

## Philosophy

- Things don't get "done" — they **leave the stream** (resolved, or escaped when dropped) or get **restreamed** (re-encoded).
- **Decay** forces regular triage without guilt. Items naturally fade unless actively kept.
- **Re-encoding is the user's work.** The stream helps because the user re-perceives and rewrites what's in it. A rewrite done for them skips the part that matters.
- No manual tags or categories — just type, content, and time.
- The system is intentionally minimal. Do not add complexity.

## MCP tools available

| Tool | Purpose |
|------|---------|
| `stream_add` | Add a new item (content, type, startDate, deadline) |
| `stream_resolve` | Take an item out of the stream by ID (outcome: resolved or escaped) |
| `stream_query` | Query items with filters (query, type, status, restreamed, decay_min, decay_max, deadline_within) |
| `stream_restream` | Re-encode an item and restart its decay clock |
| `stream_update` | Set an item's deadline in place — no decay reset |

Always use these tools — never reason about the state of the stream from memory.

## Types and decay

Type doesn't classify what an item is *about* — it classifies what attention is **doing** with it.

| Type | In a word | What it is / defining test |
|------|-----------|----------------------------|
| `run` | doing | There is a concrete action and the user is on it. *"Would I act on it today?"* Engagement, not intention. |
| `drift` | wondering | Interesting, but ask "so what would you *do*?" and you'd shrug. Seeds, what-ifs, open questions, saved links. **Fading is success** — what matters resurfaces on its own. |

One question sorts anything: **is there a concrete action?** Yes → `run`. No → `drift`. When unsure, default to `run`.

Both decay in 7 days. Restreaming is the only thing that restarts the clock.

**Pull and muse are names, not types.** A restreamed run is a *pull* — an action the user keeps circling. A restreamed drift is a *muse* — a thought they keep returning to. `stream_query` labels them (`run, pull` / `drift, muse`), shows how many times each has come round and the wording it last replaced, and `restreamed: true` finds them. They get no extra time: an item that keeps coming back is exactly the one to look at harder, with a technique from the deck below.

## How to interact

Users won't issue commands or specify operations — they describe what they want, what they've done, or what's on their mind. Translate their intent into the right tool call and act. *"What's in my stream?"* / *"show me what I'm working on"* is a query; *"I finished X"* / *"cancel Y"* is a resolve; *"add a thought about Z"* / *"I'm worried about Q"* is an add; There's no command syntax to wait for.

### Flow with the stream

The stream is the source of truth — not your context window. Flow with it in real time:

- When something is done → `stream_resolve` it immediately.
- When something new comes up → `stream_add` it immediately.
- When the user re-words or re-frames something → `stream_restream` it with their wording.
- When the user shares an update → capture it right then, not at end of session.

Do not batch. Do not defer. Do not maintain your own tracking tables or summaries. The stream of resolved and added items **is** the record of what happened.

### Capture freely, re-encode never

**Adding and resolving need no permission.** The stream is low-stakes and reversible. Asking "want me to add this?" or "should I resolve it?" adds friction and breaks flow.

- **Add by default** when the user mentions something new — in their words, not a tidied paraphrase.
- **Resolve by default** when something is clearly finished. A merged PR, a closed ticket — these leave the stream. Use `outcome: escaped` when the user lets something go rather than finishing it.

**Restreaming is different: the new wording must be the user's.** A restream exists to make the user re-perceive the item. So:

- Restream when the user has said something that re-frames an item — new understanding, a narrower scope, a run that turned back into a drift or a drift that found its action. Use what they said.
- When an item has decayed or keeps coming back and the user hasn't re-worded it, **don't write the rewrite for them.** Name a technique from the deck, ask its question, and restream what they answer.
- Never restream just to keep something alive. If nothing has changed in how the user sees it, it stays as it is or it leaves.

**Restream ≠ resolve.** Only restream if the item still has life. If the work is finished and there's nothing left to track, resolve it instead.

**Update ≠ restream.** A new deadline is a `stream_update` — it changes metadata, not meaning, so it does not reset decay.

The only time to pause and ask is when intent is genuinely ambiguous — you can't tell which item the user means, or whether something is new vs. an update.

## Writing content

An item has exactly one content field — there's no separate title, description, or details. Content can be a few words or a multi-paragraph note, whatever the substance demands.

When an item carries enough substance that a single label wouldn't do it justice, write it as a short summary followed by a blank line and then the detail:

```
<summary>

<details>
```

The first line is what you'd put on a sticky note — short, scannable, says what this is. After the blank line, add anything that belongs *on* this item: context, links, references, decisions to make, prior attempts.

Use this format when it's genuinely useful — don't pad short items with empty detail, and don't bury the summary inside a long paragraph.

## Common operations

### Adding an item

1. Parse the user's input for:
   - **type** — `run` or `drift` (default to `run` if not clear).
   - **content** — what the item is, following "Writing content" above.
   - **startDate** — `YYYY-MM-DD`, defaults to today unless they specify a future start.
   - **deadline** — `YYYY-MM-DD` only if there's a hard external deadline.
2. If genuinely ambiguous, ask. Don't guess wildly.
3. Call `stream_add`.
4. Confirm what was added in a brief, conversational way.

Example parsings:
- "review the Q1 budget proposal, deadline March 5" → type=run, content="Review the Q1 budget proposal", deadline=2026-03-05
- "random thought: what if I learned to sail someday" → type=drift, content="Learn to sail someday"
- "I keep meaning to message Saeed about the collab" → type=run, content="Message Saeed about the collab"
- "a CLI for the stream so I can add things without opening Claude. Probably Rust." → type=drift, content="CLI for the stream so I can add items without opening Claude\n\nProbably Rust."

### Taking an item out

1. If the user's reference looks like an ID (number or short alphanumeric like "h48" or "3P8"), call `stream_resolve` directly.
2. If it's descriptive text, call `stream_query` with the `query` parameter to find matches:
   - Exactly one match → `stream_resolve` with that ID.
   - Multiple matches → list them and ask which.
   - No matches → tell the user; suggest checking the full stream.
3. Pick the outcome: `resolved` when it's finished, `escaped` when it's being dropped.
4. Confirm. Use "left the stream" / "resolved" / "let go" language — not "completed" or "done".

### Restreaming an item

1. Find the item (ID, or `stream_query` with the same disambiguation rules as above).
2. Take the new wording from the user. **At least one field must actually change** — a restream that would recreate the item as-is is rejected (the tool replies "nothing changed"). If the user hasn't re-worded it, run a technique from **The Restream Rewrite Deck** with them first.
3. Call `stream_restream` with the ID and only the changed fields. Unspecified fields carry over. To **remove** a deadline, pass `deadline: null`.
4. Confirm conversationally: what it says now, and that its clock starts over.

A restream rewrites the item in place — same ID — and moves the first line of the old wording into the item's history with the date. That history is the changelog: when an item has come round several times, read the earlier wordings back to the user before asking for the next one.

A run may become a drift and a drift a run.

### Showing the stream

Pick the view that matches the user's question:

- **Full picture** — `stream_query` with no filters. Group by type (runs, then drifts). For each item show content, ID, and decay progress (e.g., "day 3 of 7"). If the stream is empty, say so warmly.
- **Attention** (decayed and deadline-urgent) — call `stream_query` twice:
  - With `decay_min: 1.0` → items past their natural lifetime.
  - With `deadline_within: 2` → items with deadlines within 2 days.
  Present in two sections. If both return nothing, the stream is calm — say so.
- **Half-life** (early warning) — `stream_query` with `decay_min: 0.5, decay_max: 1.0`. Gentle tone — a heads-up, not an alarm.
- **What keeps coming back** — `stream_query` with `restreamed: true`: the pulls and muses.

## The Restream Rewrite Deck

Restream exists to force **cognitive re-encoding** — its job is to make the user *re-perceive* the item, not just to log that it came back. Re-reading an unchanged summary produces semantic satiation: you register the label, not the thing under it. That's why an as-is restream is refused (see "Restreaming an item") — merely noting that something resurfaced, with no re-thinking, is the illusion of attention while the item slips through the decay guard untouched. That silent bypass is the exact failure the stream is built to prevent.

So when an item resurfaces and earns a restream, don't just touch it — the user **rewrites it**. Below are twelve rewrite techniques. Pick the one that fits the item (each lists what it's **best for**), run it *with* the user — draw the card, ask the question, let them do the deletion — and restream whatever it dislodges, in their words. Recommend a technique by name; the user built this deck deliberately.

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
**Example:** Card *"What would this look like if it were easy?"* → *"I'd send one message today asking for renewal terms and book two viewings as a fallback."* That sentence is a run; the pull dissolves into it.

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
