import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { FileBackend, normalizeFileItem } from "../src/file-backend.js";
import { todayStr } from "../src/utils.js";

const backend = new FileBackend();
const base = { startDate: todayStr(), deadline: null };

beforeEach(() => {
  process.env.STREAM_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "stream-")), "stream");
});

describe("file backend: restream", () => {
  it("rewrites the item in place and keeps the wording it replaced", async () => {
    const run = await backend.add({
      ...base,
      type: "run",
      content: "Reply to landlord",
      startDate: "2025-01-01",
    });
    const result = await backend.restream(run.id, { content: "Ask landlord for renewal terms" });

    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.item.id, run.id);
    assert.equal(result.replaced, undefined);
    assert.equal(result.item.content, "Ask landlord for renewal terms");
    assert.equal(result.item.startDate, todayStr());
    assert.deepEqual(result.item.history, [{ date: todayStr(), content: "Reply to landlord" }]);
    assert.deepEqual(
      (await backend.query({ status: "active", restreamed: true })).map((i) => i.id),
      [run.id],
    );
    assert.deepEqual(await backend.query({ status: "resolved" }), []);
  });

  it("lets a run become a drift, keeping its history", async () => {
    const run = await backend.add({ ...base, type: "run", content: "Set up Stripe" });
    await backend.restream(run.id, { content: "Create the Stripe account" });
    const drifted = await backend.restream(run.id, { type: "drift" });

    assert.equal(drifted.status === "ok" && drifted.item.type, "drift");
    assert.equal(drifted.status === "ok" && drifted.previousType, "run");
    assert.equal(drifted.status === "ok" && drifted.item.history.length, 2);
  });

  it("refuses a restream that changes nothing", async () => {
    const run = await backend.add({ ...base, type: "run", content: "x" });
    assert.deepEqual(await backend.restream(run.id, { content: "x" }), { status: "unchanged" });
  });
});

describe("file backend: leaving the stream", () => {
  it("records how an item left", async () => {
    const drift = await backend.add({ ...base, type: "drift", content: "Learn to sail" });
    const gone = await backend.resolve(drift.id, "escaped");
    assert.equal(gone?.outcome, "escaped");
    assert.deepEqual(await backend.query({ status: "active" }), []);
  });

  it("reads a stream file that uses a type alias", async () => {
    fs.writeFileSync(
      process.env.STREAM_FILE!,
      JSON.stringify({
        nextId: 2,
        items: [
          {
            id: 1,
            type: "pull",
            content: "Message Saeed",
            startDate: "2025-01-01",
            deadline: null,
            hook: "none",
            resolvedAt: null,
            createdAt: "2025-01-01T00:00:00Z",
          },
        ],
      }),
    );
    const [item] = await backend.query({ status: "active" });
    assert.equal(item.type, "run");
    assert.deepEqual(item.history, []);
  });
});

describe("normalizeFileItem", () => {
  const stored = {
    id: 1,
    content: "x",
    startDate: "2025-01-01",
    createdAt: "2025-01-01T00:00:00Z",
  };

  it("resolves the type aliases live, pull and muse", () => {
    assert.equal(normalizeFileItem({ ...stored, type: "live" }).type, "run");
    assert.equal(normalizeFileItem({ ...stored, type: "pull" }).type, "run");
    assert.equal(normalizeFileItem({ ...stored, type: "muse" }).type, "drift");
    assert.equal(normalizeFileItem({ ...stored, type: "drift" }).type, "drift");
  });

  it("defaults absent fields and drops unknown ones", () => {
    const item = normalizeFileItem({ ...stored, type: "run", hook: "passion" } as never);
    assert.deepEqual(item, {
      ...stored,
      type: "run",
      deadline: null,
      history: [],
      resolvedAt: null,
      outcome: null,
    });
  });

  it("reads a resolved item with no recorded outcome as resolved", () => {
    const item = normalizeFileItem({ ...stored, type: "run", resolvedAt: "2025-01-02T00:00:00Z" });
    assert.equal(item.outcome, "resolved");
  });
});
