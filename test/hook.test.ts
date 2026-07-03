import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { priorityForHook, hookForPriority } from "../src/todoist-backend.js";
import { HOOKS, type Hook } from "../src/types.js";

// The engagement hook rides the otherwise-unused Todoist priority flag. Priority
// is a 1–4 integer (4 = p1/urgent, 1 = p4/default). These lock the mapping so a
// stray edit can't silently swap which priority means which hook.
describe("hook ↔ Todoist priority", () => {
  it("maps each hook to its priority", () => {
    assert.equal(priorityForHook(null), 1); // unset → default
    assert.equal(priorityForHook("interest"), 2);
    assert.equal(priorityForHook("passion"), 3);
    assert.equal(priorityForHook("none"), 4); // at-risk items shout (p1)
  });

  it("reads each priority back to its hook", () => {
    assert.equal(hookForPriority(1), null);
    assert.equal(hookForPriority(2), "interest");
    assert.equal(hookForPriority(3), "passion");
    assert.equal(hookForPriority(4), "none");
  });

  it("round-trips every hook state (incl. unset)", () => {
    const states: Array<Hook | null> = [null, ...HOOKS];
    for (const hook of states) {
      assert.equal(hookForPriority(priorityForHook(hook)), hook);
    }
  });

  it("treats an unknown priority as unset", () => {
    assert.equal(hookForPriority(0), null);
    assert.equal(hookForPriority(99), null);
  });
});
