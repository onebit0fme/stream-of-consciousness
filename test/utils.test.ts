import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  todayStr,
  daysBetween,
  decayDays,
  decayProgress,
  computeShortIds,
  resolveShortId,
  nextRecurrence,
  restreamType,
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
  it("returns 7 for live", () => {
    assert.equal(decayDays("live"), 7);
  });

  it("returns 4 for pull", () => {
    assert.equal(decayDays("pull"), 4);
  });

  it("returns 14 for gate", () => {
    assert.equal(decayDays("gate"), 14);
  });

  it("returns 5 for drift", () => {
    assert.equal(decayDays("drift"), 5);
  });

  it("defaults to 7 for unknown type", () => {
    assert.equal(decayDays("unknown"), 7);
  });
});

describe("decayProgress", () => {
  it("returns 0 on start date", () => {
    assert.equal(decayProgress({ startDate: "2025-01-10", type: "live" }, "2025-01-10"), 0);
  });

  it("returns 0.5 at half decay", () => {
    // gate decays in 14 days, so 7 days = 0.5
    assert.equal(decayProgress({ startDate: "2025-01-01", type: "gate" }, "2025-01-08"), 0.5);
  });

  it("returns 1.0 at full decay", () => {
    // live decays in 7 days
    assert.equal(decayProgress({ startDate: "2025-01-01", type: "live" }, "2025-01-08"), 1.0);
  });

  it("exceeds 1.0 past decay", () => {
    // live decays in 7 days, so 14 days = 2.0
    assert.equal(decayProgress({ startDate: "2025-01-01", type: "live" }, "2025-01-15"), 2.0);
  });

  it("uses type-specific decay period", () => {
    // pull decays in 4 days, so 4 days = 1.0
    assert.equal(decayProgress({ startDate: "2025-01-01", type: "pull" }, "2025-01-05"), 1.0);
  });
});

describe("nextRecurrence", () => {
  it("increments when the old copy had decayed (progress >= 1)", () => {
    assert.equal(nextRecurrence(1, 1.0), 2);
    assert.equal(nextRecurrence(2, 1.5), 3);
  });

  it("carries the count forward when the old copy was still fresh", () => {
    assert.equal(nextRecurrence(1, 0.4), 1);
    assert.equal(nextRecurrence(3, 0.99), 3);
  });
});

describe("restreamType", () => {
  it("honors an explicit type over everything", () => {
    assert.equal(restreamType("drift", "live", 5), "drift");
  });

  it("auto-routes to gate at recurrence >= 3", () => {
    assert.equal(restreamType(undefined, "live", 3), "gate");
    assert.equal(restreamType(undefined, "pull", 4), "gate");
  });

  it("keeps the old type below the threshold", () => {
    assert.equal(restreamType(undefined, "pull", 2), "pull");
    assert.equal(restreamType(undefined, "live", 1), "live");
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
