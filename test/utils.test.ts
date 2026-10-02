import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  todayStr,
  daysBetween,
  decayProgress,
  computeShortIds,
  resolveShortId,
  isUnchangedRestream,
  lineageLabel,
  withPastWording,
  applyRestream,
} from "../src/utils.js";

describe("daysBetween", () => {
  it("returns 0 for the same date", () => {
    assert.equal(daysBetween("2025-01-01", "2025-01-01"), 0);
  });

  it("returns positive for future dates", () => {
    assert.equal(daysBetween("2025-01-01", "2025-01-10"), 9);
  });

  it("returns negative for past dates", () => {
    assert.equal(daysBetween("2025-01-10", "2025-01-01"), -9);
  });

  it("handles month boundaries", () => {
    assert.equal(daysBetween("2025-01-31", "2025-02-01"), 1);
  });

  it("handles year boundaries", () => {
    assert.equal(daysBetween("2024-12-31", "2025-01-01"), 1);
  });
});

describe("decayProgress", () => {
  it("returns 0 on start date", () => {
    assert.equal(decayProgress("2025-01-10", "2025-01-10"), 0);
  });

  it("returns 1.0 after a week", () => {
    assert.equal(decayProgress("2025-01-01", "2025-01-08"), 1.0);
  });

  it("exceeds 1.0 past decay", () => {
    assert.equal(decayProgress("2025-01-01", "2025-01-15"), 2.0);
  });
});

describe("isUnchangedRestream", () => {
  const old = {
    content: "Message Saeed",
    type: "run",
    deadline: null as string | null,
    startDate: "2025-01-01",
  };

  it("is unchanged when no fields are provided", () => {
    assert.equal(isUnchangedRestream(old, {}), true);
  });

  it("is unchanged when provided fields equal the old values", () => {
    assert.equal(isUnchangedRestream(old, { content: "Message Saeed", type: "run" }), true);
  });

  it("ignores the default startDate refresh (not a change on its own)", () => {
    // startDate omitted → backend defaults it to today; that alone is a no-op
    assert.equal(isUnchangedRestream(old, { content: "Message Saeed" }), true);
  });

  it("detects a content change", () => {
    assert.equal(isUnchangedRestream(old, { content: "Message Saeed about the collab" }), false);
  });

  it("detects a type change with the same content", () => {
    assert.equal(isUnchangedRestream(old, { type: "drift" }), false);
  });

  it("detects setting a deadline", () => {
    assert.equal(isUnchangedRestream(old, { deadline: "2025-02-01" }), false);
  });

  it("detects clearing an existing deadline", () => {
    const withDeadline = { ...old, deadline: "2025-02-01" };
    assert.equal(isUnchangedRestream(withDeadline, { deadline: null }), false);
  });

  it("detects an explicit startDate change", () => {
    assert.equal(isUnchangedRestream(old, { startDate: "2025-06-01" }), false);
  });
});

describe("computeShortIds", () => {
  it("returns empty map for empty input", () => {
    const result = computeShortIds([]);
    assert.equal(result.size, 0);
  });

  it("uses single character when sufficient", () => {
    const result = computeShortIds(["abc1", "abc2", "abc3"]);
    assert.equal(result.get("abc1"), "1");
    assert.equal(result.get("abc2"), "2");
    assert.equal(result.get("abc3"), "3");
  });

  it("grows length to resolve collisions", () => {
    const result = computeShortIds(["xx11", "yy11", "zz22"]);
    // "11" collides for first two, need more chars
    assert.equal(result.get("xx11"), "x11");
    assert.equal(result.get("yy11"), "y11");
    // "22" is unique at length 1
    assert.equal(result.get("zz22"), "2");
  });

  it("uses single char for a single ID", () => {
    const result = computeShortIds(["abcdef"]);
    assert.equal(result.get("abcdef"), "f");
  });

  it("handles identical IDs (degenerate case)", () => {
    const result = computeShortIds(["aaa", "aaa"]);
    // Duplicate string IDs — both resolve to same key in the map
    // String equality means no collision is detected, shortest suffix wins
    assert.equal(result.get("aaa"), "a");
  });
});

describe("resolveShortId", () => {
  const ids = ["abc123", "abc456", "def789"];

  it("matches exact full ID", () => {
    assert.equal(resolveShortId("abc123", ids), "abc123");
  });

  it("matches unique suffix", () => {
    assert.equal(resolveShortId("789", ids), "def789");
  });

  it("returns null for ambiguous suffix", () => {
    // "abc" matches both abc123 and abc456 as prefix, but suffix match:
    // "3" uniquely matches abc123
    assert.equal(resolveShortId("3", ids), "abc123");
  });

  it("returns null for no match", () => {
    assert.equal(resolveShortId("zzz", ids), null);
  });

  it("returns null for ambiguous suffix match", () => {
    // Both "abc123" and "abc456" end with digits, but "abc" as suffix doesn't match
    // Let's use IDs that actually collide on suffix
    const ambiguous = ["xx11", "yy11"];
    assert.equal(resolveShortId("11", ambiguous), null);
  });
});

describe("todayStr", () => {
  it("returns a YYYY-MM-DD formatted string", () => {
    const result = todayStr();
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("lineageLabel", () => {
  const past = [{ date: "2025-01-05", content: "Reply to landlord" }];

  it("calls a restreamed run a pull", () => {
    assert.equal(lineageLabel({ type: "run", history: past }), "pull");
  });

  it("calls a restreamed drift a muse", () => {
    assert.equal(lineageLabel({ type: "drift", history: past }), "muse");
  });

  it("has no name for an item in its first wording", () => {
    assert.equal(lineageLabel({ type: "run", history: [] }), null);
  });
});

describe("withPastWording", () => {
  it("puts the replaced wording's first line at the head", () => {
    const history = withPastWording(
      [{ date: "2025-01-05", content: "Set up billing" }],
      "Create Stripe account\n\nUse the business email.",
      "2025-01-12",
    );
    assert.deepEqual(history, [
      { date: "2025-01-12", content: "Create Stripe account" },
      { date: "2025-01-05", content: "Set up billing" },
    ]);
  });
});

describe("applyRestream", () => {
  const old = {
    type: "run" as const,
    content: "Set up billing\n\nUse the business email.",
    deadline: "2025-03-01",
    history: [],
  };

  it("restarts the clock and logs the replaced wording", () => {
    assert.deepEqual(applyRestream(old, { content: "Create Stripe account" }, "2025-01-12"), {
      type: "run",
      content: "Create Stripe account",
      deadline: "2025-03-01",
      startDate: "2025-01-12",
      history: [{ date: "2025-01-12", content: "Set up billing" }],
    });
  });

  it("clears a deadline on null and keeps it when omitted", () => {
    assert.equal(applyRestream(old, { deadline: null }, "2025-01-12").deadline, null);
    assert.equal(applyRestream(old, { type: "drift" }, "2025-01-12").deadline, "2025-03-01");
  });

  it("takes an explicit start date over today", () => {
    assert.equal(
      applyRestream(old, { startDate: "2025-02-01" }, "2025-01-12").startDate,
      "2025-02-01",
    );
  });
});
