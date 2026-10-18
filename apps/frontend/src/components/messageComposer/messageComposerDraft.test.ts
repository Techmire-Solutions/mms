import { afterEach, describe, expect, it } from "vitest";
import {
  clearComposerDraft,
  readComposerDraft,
  writeComposerDraft,
  resolveComposerUserId,
} from "./messageComposerDraft";
import { resolveComposerInitialState } from "./messageComposerInitialState";

describe("messageComposerDraft", () => {
  afterEach(() => {
    clearComposerDraft("sms", "user-1");
    clearComposerDraft("sms", undefined);
    clearComposerDraft("email", "user-1");
  });

  it("scopes draft keys by user id", () => {
    writeComposerDraft({
      v: 1,
      channel: "sms",
      userId: "user-1",
      message: "Hello",
      subject: "",
      templateId: "custom",
      recipients: [],
    });
    expect(readComposerDraft("sms", "user-1")?.message).toBe("Hello");
    expect(readComposerDraft("sms", "user-2")).toBeNull();
    expect(readComposerDraft("sms", undefined)).toBeNull();
  });

  it("rejects channel mismatch and resolves user id", () => {
    writeComposerDraft({
      v: 1,
      channel: "email",
      userId: "user-1",
      message: "Body",
      subject: "Subj",
      templateId: "custom",
      recipients: [{ id: "c1", name: "A", phone: "+10000000000" }],
    });
    expect(readComposerDraft("sms", "user-1")).toBeNull();
    expect(resolveComposerUserId({ id: 42 })).toBe("42");
    expect(resolveComposerUserId(null)).toBeUndefined();
  });

  it("prefers initialMessage over draft on restore", () => {
    writeComposerDraft({
      v: 1,
      channel: "sms",
      userId: "user-1",
      message: "From draft",
      subject: "",
      templateId: "tpl-1",
      recipients: [],
    });
    const state = resolveComposerInitialState({
      channel: "sms",
      recipients: [],
      initialMessage: "From prop",
      channelTemplates: [],
      activeTemplates: [],
      user: { id: "user-1" },
    });
    expect(state.message).toBe("From prop");
    expect(state.draft?.message).toBe("From draft");
  });
});
