import { describe, expect, it } from "vitest";
import { canTransitionJournal, isPostingWindowOpen } from "./index.js";

describe("accounting shared policy", () => {
  it("allows only draft→posted and posted→reversed", () => {
    expect(canTransitionJournal("draft", "posted")).toBe(true);
    expect(canTransitionJournal("posted", "reversed")).toBe(true);
    expect(canTransitionJournal("posted", "draft")).toBe(false);
    expect(canTransitionJournal("reversed", "posted")).toBe(false);
  });

  it("blocks posting into a closed fiscal year or period", () => {
    expect(isPostingWindowOpen({ fiscalYearStatus: "open" })).toBe(true);
    expect(isPostingWindowOpen({ fiscalYearStatus: "closed" })).toBe(false);
    expect(isPostingWindowOpen({ fiscalYearStatus: "open", periodStatus: "closed" })).toBe(false);
  });
});
