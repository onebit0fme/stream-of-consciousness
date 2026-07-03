# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-07-03

This release reworks the core model — the motion-state taxonomy, the Todoist
mapping, and restream semantics — and adds a per-item engagement signal. Several
changes are breaking; see [Migration](#migration) below.

### Added

- **The hook — a per-item engagement signal** (Dr. William Dodson's
  interest-based nervous system). Not a free-form label but a four-state read of
  whether an item has something that can actually get you to engage it: `null`
  (unset / not triaged), `interest` (an in-the-moment hook — interesting,
  challenging, or novel), `passion` (tied to something deeper and lasting), and
  `none` (explicitly hookless — at risk, needs a hook or should be dropped).
  Urgency is deliberately absent from this axis; that motivator is carried by
  deadline + decay. `stream_add` accepts a hook, `stream_query` surfaces it, and
  `stream_restream` carries the old value forward unless overridden.
- **`stream_update` tool** — a light-touch metadata patch for an item's hook
  and/or deadline that does **not** reset the decay clock or create a new version.
  This is the counterpart to `stream_restream`, which is reserved for genuine
  content/type re-encodings. Setting or changing a hook routes here, not through
  a restream.
- **The Restream Rewrite Deck** in the skill — 12 techniques (ostranenie,
  register shift, oblique constraint, cut-up, via negativa, inversion,
  bisociation, incubation, negative-space carving, cause-&-insight language,
  distanced rewrite, affect labeling) for *how* to re-encode an item on restream.

### Changed

- **BREAKING — the motion-state `gate` was replaced by `muse`.** The four types
  are now `live` / `pull` / `muse` / `drift`. Decay windows retuned to
  `live` 7d, `pull` 4d, `muse` 21d, `drift` 5d (`gate` was 14d). A
  decision-with-a-known-next-step is now a `pull`; a pure return-to-dwell is a
  `muse`.
- **BREAKING — Todoist carries an item's type via named sections, not
  priority.** Sections `Live` / `Pull` / `Muse` are created on demand (scoped to
  the configured project, or the account Inbox in no-project mode); `drift` = no
  section. This frees the priority flag, which now carries the hook instead.
- **BREAKING — `stream_restream` rejects a no-op restream.** Its result is now a
  discriminated `ok` / `not_found` / `unchanged`; a restream that would recreate
  the item as-is changes nothing and asks you to resolve it instead. Restream's
  purpose is to force cognitive re-encoding, so a verbatim restream is refused.
- **`stream_restream` can now clear a deadline** by passing `null` (previously an
  existing deadline could not be unset on restream).
- **Todoist task descriptions and comments are folded into item content** so
  nothing is silently dropped on read or restream.

### Removed

- **BREAKING — recurrence removed entirely.** The internal `recurrence` field,
  the Todoist `↻N` label machinery, and all related tool parameters and skill
  documentation are gone. The counter masked the silent failure that decay is
  meant to surface.
- **BREAKING — explicit restream lineage removed.** The `restreamedFrom` field
  and the "Restreamed from:" breadcrumb comment/link that Todoist restreams
  posted on the new task are gone. A restream still resolves the old item and
  creates a new one — it just no longer records an explicit pointer between
  them. The feature was half-implemented (a field in the file backend, a comment
  in Todoist) and unused.

### Fixed

- Todoist restream no longer drops a task's description when the content is
  otherwise unchanged (e.g. a type-only restream); the full title + body is
  carried forward.

### Migration

- **Todoist type → sections:** pre-existing stream tasks (which encoded type via
  priority) have no section, so they read as `drift` until restreamed or moved
  into a `Live` / `Pull` / `Muse` section. There is no automatic migration.
- **Todoist priority → hook:** the priority flag now carries the hook
  (`p4`/default = unset, `p3` = interest, `p2` = passion, `p1` = none). Any
  priority set manually on a stream task will be read back as a hook.
- **Recurrence `↻N` labels:** left on any live Todoist task are simply ignored on
  read; no cleanup is required.
- **Restream lineage comments:** any "Restreamed from:" comment a previous
  version posted on a Todoist task is no longer filtered out, so it will fold
  into that item's content the next time it is read or restreamed. Harmless and
  self-clearing; delete the comment in Todoist if you want it gone sooner.
- **File backend:** legacy items stored without a `hook` field read as `null`
  (unset). Any stored `restreamedFrom` value is ignored. No file rewrite is
  needed.

## [1.5.0] - 2026-06-23

Retrospective entry reconstructed from git history.

### Added

- Todoist backend, with the file backend as the default local store.
- Remote MCP deployment to Cloudflare Workers, with per-connection Todoist
  project scoping and OAuth token refresh.
- Motion-state type taxonomy (`live` / `pull` / `gate` / `drift`) replacing the
  earlier content taxonomy (task / thought / idea / output).
- Recurrence tracking with provenance.

### Changed

- Dates are cleared once an item enters the stream; no-project behavior
  clarified. Todoist task descriptions are used as item content; short IDs
  trimmed to the last character.

## [1.0.0] - 2026-03-22

### Added

- Initial release: a file-backed "stream" with mandatory time-based decay,
  exposed over MCP (`stream_add`, `stream_resolve`, `stream_query`,
  `stream_restream`) and packaged as a Claude Code plugin/skill.

[2.0.0]: https://github.com/onebit0fme/stream-of-consciousness/compare/v1.5.0...v2.0.0
[1.5.0]: https://github.com/onebit0fme/stream-of-consciousness/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/onebit0fme/stream-of-consciousness/releases/tag/v1.0.0
