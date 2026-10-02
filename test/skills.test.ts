import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";

const read = (file: string) => fs.readFileSync(file, "utf-8");
const lean = read("plugins/stream-of-consciousness/skills/stream/SKILL.md");

/** The text of `source` from `start` up to (not including) `end`, trimmed. */
function section(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from !== -1 && to !== -1, `section "${start}" … "${end}" not found`);
  return source.slice(from, to).trim();
}

// Each plugin installs on its own, so the two skills can't share a file. The
// rewrite deck is kept word for word the same in both; this fails when one
// copy is edited and the other isn't.
describe("the two stream skills agree", () => {
  it("on the rewrite deck", () => {
    const deck = read("plugins/stream-capacities/skills/stream/rewrite-deck.md").trim();
    assert.equal("#" + deck, section(lean, "## The Restream Rewrite Deck", "## Tone"));
  });
});
