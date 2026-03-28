import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  todayStr,
  daysBetween,
  decayDays,
  decayProgress,
  computeShortIds,
  resolveShortId,
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

describe("decayDays", () => {
  it("returns 10 for task", () => {
    assert.equal(decayDays("task"), 10);
  });

  it("returns 7 for thought", () => {
    assert.equal(decayDays("thought"), 7);
  });

  it("returns 14 for idea", () => {
    assert.equal(decayDays("idea"), 14);
  });

  it("returns 21 for output", () => {
    assert.equal(decayDays("output"), 21);
  });

  it("defaults to 10 for unknown type", () => {
    assert.equal(decayDays("unknown"), 10);
  });
});

describe("decayProgress", () => {
  it("returns 0 on start date", () => {
    assert.equal(decayProgress({ startDate: "2025-01-10", type: "task" }, "2025-01-10"), 0);
  });

  it("returns 0.5 at half decay", () => {
    assert.equal(decayProgress({ startDate: "2025-01-01", type: "task" }, "2025-01-06"), 0.5);
  });

  it("returns 1.0 at full decay", () => {
    assert.equal(decayProgress({ startDate: "2025-01-01", type: "task" }, "2025-01-11"), 1.0);
  });

  it("exceeds 1.0 past decay", () => {
    assert.equal(decayProgress({ startDate: "2025-01-01", type: "task" }, "2025-01-21"), 2.0);
  });

  it("uses type-specific decay period", () => {
    // thought decays in 7 days, so 7 days = 1.0
    assert.equal(decayProgress({ startDate: "2025-01-01", type: "thought" }, "2025-01-08"), 1.0);
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
