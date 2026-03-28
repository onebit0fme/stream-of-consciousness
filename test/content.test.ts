import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  splitContent,
  mergeContent,
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
