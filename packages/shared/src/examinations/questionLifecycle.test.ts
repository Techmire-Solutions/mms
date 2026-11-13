import { describe, expect, it } from "vitest";
import {
  allowedNextQuestionStatuses,
  canTransitionQuestion,
  isQuestionContentLocked,
  isQuestionStatus,
  requiresQuestionApprovalAuthority,
  QUESTION_STATUSES,
  QUESTION_STATUS_TRANSITIONS,
} from "./questionLifecycle.js";

describe("question lifecycle", () => {
  it("matches the transition table for every ordered status pair", () => {
    for (const from of QUESTION_STATUSES) {
      for (const to of QUESTION_STATUSES) {
        const expected =
          from === to || (QUESTION_STATUS_TRANSITIONS[from] as readonly string[]).includes(to);
        expect(canTransitionQuestion(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });

  it("treats a no-op as an update, not a transition", () => {
    for (const status of QUESTION_STATUSES) {
      expect(canTransitionQuestion(status, status)).toBe(true);
    }
  });

  it("fails closed for unknown statuses", () => {
    expect(canTransitionQuestion("draft", "archived")).toBe(false);
    expect(canTransitionQuestion("legacy", "draft")).toBe(false);
    expect(allowedNextQuestionStatuses("legacy")).toEqual([]);
    expect(allowedNextQuestionStatuses(null)).toEqual([]);
    expect(isQuestionStatus("approved")).toBe(true);
    expect(isQuestionStatus("published")).toBe(false);
  });

  it("allows creating with any valid status", () => {
    for (const status of QUESTION_STATUSES) {
      expect(canTransitionQuestion(null, status)).toBe(true);
    }
  });

  it("keeps retired reopenable but approved not directly editable", () => {
    expect(allowedNextQuestionStatuses("retired")).toEqual(["draft"]);
    expect(allowedNextQuestionStatuses("approved")).toEqual(["retired"]);
    expect(isQuestionContentLocked("approved")).toBe(true);
    expect(isQuestionContentLocked("retired")).toBe(true);
    expect(isQuestionContentLocked("draft")).toBe(false);
    expect(isQuestionContentLocked("under_review")).toBe(false);
  });

  it("gates approval and retirement one step above authoring", () => {
    expect(requiresQuestionApprovalAuthority("approved")).toBe(true);
    expect(requiresQuestionApprovalAuthority("retired")).toBe(true);
    expect(requiresQuestionApprovalAuthority("draft")).toBe(false);
    expect(requiresQuestionApprovalAuthority("under_review")).toBe(false);
  });
});
