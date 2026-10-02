import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  splitContent,
  mergeContent,
  foldComments,
  splitLog,
  withLog,
  CONTENT_LIMIT,
  TRUNCATION_SENTINEL,
} from "../src/todoist-backend.js";

describe("splitContent", () => {
  it("short single-line text stays as content, empty description", () => {
    const result = splitContent("Buy groceries");
    assert.equal(result.content, "Buy groceries");
    assert.equal(result.description, "");
  });

  it("multi-line splits on first newline", () => {
    const result = splitContent("Buy groceries\nmilk\neggs\nbread");
    assert.equal(result.content, "Buy groceries");
    assert.equal(result.description, "milk\neggs\nbread");
  });

  it("exactly 500 char title stays intact", () => {
    const title = "a".repeat(500);
    const result = splitContent(title);
    assert.equal(result.content, title);
    assert.equal(result.description, "");
  });

  it("501 char title gets truncated with sentinel", () => {
    const title = "a".repeat(501);
    const result = splitContent(title);
    assert.equal(result.content.length, CONTENT_LIMIT);
    assert.ok(result.content.endsWith(TRUNCATION_SENTINEL));
    assert.equal(result.content, "a".repeat(499) + TRUNCATION_SENTINEL);
    // Description holds the full original text
    assert.equal(result.description, title);
  });

  it("long title with body — truncation puts full text in description", () => {
    const title = "x".repeat(600);
    const body = "some details";
    const result = splitContent(title + "\n" + body);
    assert.equal(result.content, "x".repeat(499) + TRUNCATION_SENTINEL);
    assert.equal(result.description, title + "\n" + body);
  });

  it("empty string returns empty content and description", () => {
    const result = splitContent("");
    assert.equal(result.content, "");
    assert.equal(result.description, "");
  });

  it("text with only a newline", () => {
    const result = splitContent("\nsome body");
    assert.equal(result.content, "");
    assert.equal(result.description, "some body");
  });
});

describe("mergeContent", () => {
  it("no description returns content as-is", () => {
    assert.equal(mergeContent("Buy groceries"), "Buy groceries");
  });

  it("null description returns content as-is", () => {
    assert.equal(mergeContent("Buy groceries", null), "Buy groceries");
  });

  it("empty string description returns content as-is", () => {
    assert.equal(mergeContent("Buy groceries", ""), "Buy groceries");
  });

  it("content with description joins with double newline", () => {
    assert.equal(
      mergeContent("Buy groceries", "milk\neggs\nbread"),
      "Buy groceries\n\nmilk\neggs\nbread"
    );
  });

  it("truncated content with sentinel uses description as full text", () => {
    const fullText = "a".repeat(600);
    const truncated = "a".repeat(499) + TRUNCATION_SENTINEL;
    assert.equal(mergeContent(truncated, fullText), fullText);
  });

  it("content naturally ending with sentinel still uses description", () => {
    // Edge case: if someone writes content ending with →
    // This is by design — the sentinel is chosen to be unnatural
    const result = mergeContent("something" + TRUNCATION_SENTINEL, "full text");
    assert.equal(result, "full text");
  });
});

describe("splitContent/mergeContent round-trip", () => {
  it("short single-line round-trips", () => {
    const original = "Buy groceries";
    const { content, description } = splitContent(original);
    assert.equal(mergeContent(content, description || undefined), original);
  });

  it("multi-line round-trips", () => {
    const original = "Buy groceries\nmilk\neggs\nbread";
    const { content, description } = splitContent(original);
    // Split uses \n, merge uses \n\n — so multi-line doesn't perfectly round-trip
    // This is by design: Todoist-created items get visual separation
    assert.equal(mergeContent(content, description), "Buy groceries\n\nmilk\neggs\nbread");
  });

  it("long title round-trips via description", () => {
    const original = "a".repeat(600);
    const { content, description } = splitContent(original);
    assert.equal(mergeContent(content, description), original);
  });

  it("long title with body round-trips via description", () => {
    const original = "x".repeat(600) + "\nsome details";
    const { content, description } = splitContent(original);
    assert.equal(mergeContent(content, description), original);
  });
});

// Regression for the restream content-carry-over bug: a restream that doesn't
// change content must re-carry the FULL text, which is why the Todoist backend
// reconstructs it with mergeContent(title, description) rather than reusing the
// bare Todoist title. These lock the invariant that reusing the title alone is
// lossy — the exact mistake the fix corrected.
describe("restream content carry-over (regression)", () => {
  it("multi-line: the bare title drops the body; merge carries it", () => {
    const original = "CLI for the stream\n\nProbably Rust. Could lift the TS types.";
    const { content, description } = splitContent(original);

    // The bug reused `content` (the title) alone — which loses the body:
    assert.notEqual(content, original);
    assert.ok(!content.includes("Probably Rust"));

    // The fix reuses the merged full content, which keeps the body:
    assert.ok(mergeContent(content, description).includes("Probably Rust"));
  });

  it("long single line: the bare title keeps a dangling sentinel; merge recovers full text", () => {
    const original = "z".repeat(600);
    const { content, description } = splitContent(original);

    // Reusing the title alone leaves a truncated string ending in the sentinel:
    assert.ok(content.endsWith(TRUNCATION_SENTINEL));
    assert.notEqual(content, original);

    // The merged full content is the untruncated original:
    assert.equal(mergeContent(content, description), original);
  });
});

describe("foldComments", () => {
  const at = (n: number) => `2026-07-0${n}T00:00:00Z`;

  it("returns content unchanged when there are no comments", () => {
    assert.equal(foldComments("Ship the thing", []), "Ship the thing");
  });

  it("appends a comment after a blank line", () => {
    assert.equal(
      foldComments("Ship the thing", [{ content: "blocked on review", postedAt: at(1) }]),
      "Ship the thing\n\nblocked on review"
    );
  });

  it("folds multiple comments oldest first, regardless of input order", () => {
    const result = foldComments("Base", [
      { content: "second", postedAt: at(2) },
      { content: "first", postedAt: at(1) },
      { content: "third", postedAt: at(3) },
    ]);
    assert.equal(result, "Base\n\nfirst\n\nsecond\n\nthird");
  });

  it("ignores blank/whitespace-only comments", () => {
    assert.equal(foldComments("Base", [{ content: "   \n  ", postedAt: at(1) }]), "Base");
  });

  it("trims surrounding whitespace on each folded comment", () => {
    assert.equal(
      foldComments("Base", [{ content: "  padded note  ", postedAt: at(1) }]),
      "Base\n\npadded note"
    );
  });
});

describe("restream log", () => {
  const history = [
    { date: "2026-09-28", content: "Create Stripe account" },
    { date: "2026-09-22", content: "Set up billing" },
  ];

  it("leaves content without history untouched", () => {
    assert.equal(withLog("Open the Stripe signup", []), "Open the Stripe signup");
    assert.deepEqual(splitLog("Open the Stripe signup"), {
      content: "Open the Stripe signup",
      history: [],
    });
  });

  it("round-trips through a task's title and description", () => {
    for (const content of ["Open the Stripe signup", "Open the Stripe signup\n\nUse the business email."]) {
      const stored = splitContent(withLog(content, history));
      assert.deepEqual(splitLog(mergeContent(stored.content, stored.description)), {
        content,
        history,
      });
    }
  });

  it("reads only the trailing log lines as history", () => {
    const text = "Title\n\n↻ 2026-01-01 a line in the body\nmore body\n\n↻ 2026-09-22 Set up billing";
    assert.deepEqual(splitLog(text).history, [{ date: "2026-09-22", content: "Set up billing" }]);
  });
});
