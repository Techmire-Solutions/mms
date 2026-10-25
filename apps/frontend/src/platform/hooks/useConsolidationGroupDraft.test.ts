import { describe, expect, it } from "vitest";
import { applyMemberPatch, buildGroupPayload, createGroupDraft } from "./useConsolidationGroupDraft";

describe("consolidation group draft", () => {
  it("given a named group with one parent, should build a valid payload", () => {
    // Arrange
    const draft = createGroupDraft(null);
    const members = applyMemberPatch(draft.members, draft.members[0].key, { memberSubdomain: "parent" });

    // Act
    const parsed = buildGroupPayload({ ...draft, name: "Group", members });

    // Assert
    expect(parsed).toEqual({
      ok: true,
      body: {
        name: "Group",
        presentationCurrency: "PKR",
        intercompanyAccountCodes: [],
        members: [{ memberSubdomain: "parent", ownershipPercent: 100, isParent: true }],
      },
    });
  });

  it("given a second member marked as parent, should move the parent flag to it", () => {
    // Arrange
    const draft = createGroupDraft(null);
    const second = { ...draft.members[0], key: "second", isParent: false };

    // Act
    const members = applyMemberPatch([draft.members[0], second], "second", { isParent: true });

    // Assert
    expect(members.map((member) => member.isParent)).toEqual([false, true]);
  });

  it("given no name, should fail with a translation key", () => {
    // Arrange / Act
    const parsed = buildGroupPayload(createGroupDraft(null));

    // Assert
    expect(parsed.ok).toBe(false);
  });
});
