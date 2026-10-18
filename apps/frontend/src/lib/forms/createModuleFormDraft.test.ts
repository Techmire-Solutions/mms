import { describe, expect, it } from "vitest";
import { createModuleFormDraft } from "@/lib/forms/createModuleFormDraft";

const draft = createModuleFormDraft<{ name: string; status: string; hydrated?: string }>({
  volatileKeys: ["hydrated"],
  getDefaults: (record) => ({ name: record?.name ?? "", status: "active" }),
});

describe("createModuleFormDraft", () => {
  it("getInitialDraft seeds defaults when no record is given", () => {
    expect(draft.getInitialDraft()).toEqual({ name: "", status: "active" });
  });

  it("getInitialDraft copies non-volatile record keys not already in defaults", () => {
    const result = draft.getInitialDraft({ name: "Ali", status: "inactive", hydrated: "x" });
    // Defaults take precedence for keys already present in the seed (status).
    expect(result).toEqual({ name: "Ali", status: "active" });
  });

  it("getInitialDraft skips volatile keys", () => {
    const result = draft.getInitialDraft({ name: "Ali", hydrated: "should-not-appear" });
    expect(result.hydrated).toBeUndefined();
  });

  it("draftSnapshot omits volatile keys and nulls empty values", () => {
    const snapshot = draft.draftSnapshot({ name: "Ali", status: "active", hydrated: "x" });
    expect(JSON.parse(snapshot)).toEqual({ name: "Ali", status: "active" });
  });
});
