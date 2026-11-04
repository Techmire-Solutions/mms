import { describe, expect, it } from "vitest";
import { resolveSubmissionKey } from "./messageComposerSubmissionKey";

describe("resolveSubmissionKey", () => {
  it("reuses the key while the same composition is retried", () => {
    const first = resolveSubmissionKey(null, "digest-a", () => "key-1");
    expect(first.key).toBe("key-1");

    const retry = resolveSubmissionKey(first.state, "digest-a", () => "key-2");
    expect(retry.key).toBe("key-1");
    expect(retry.state).toBe(first.state);
  });

  it("mints a new key when the composition changes", () => {
    const first = resolveSubmissionKey(null, "digest-a", () => "key-1");
    const changed = resolveSubmissionKey(first.state, "digest-b", () => "key-2");
    expect(changed.key).toBe("key-2");
    expect(changed.state.digest).toBe("digest-b");
  });

  it("mints a new key for a deliberate repeat after a completed submission", () => {
    const first = resolveSubmissionKey(null, "digest-a", () => "key-1");
    const completed = { ...first.state, completed: true };

    const repeat = resolveSubmissionKey(completed, "digest-a", () => "key-2");
    expect(repeat.key).toBe("key-2");
    expect(repeat.state.completed).toBe(false);
  });
});
