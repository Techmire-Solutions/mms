import { describe, expect, it } from "vitest";
import { isExamDraftDirty, validateExamDraft } from "./examFormValidation";

const valid = {
  name: "Midterm",
  date: "2026-03-10",
  classIds: ["c-1"],
  totalMarks: 100,
  passingMarks: 50,
  duration: 60,
};

describe("validateExamDraft", () => {
  it("accepts a complete authoring frame", () => {
    expect(validateExamDraft(valid)).toEqual({});
  });

  it("flags passing above total, non-positive totals and a blank duration immediately", () => {
    expect(validateExamDraft({ ...valid, passingMarks: 120 })).toMatchObject({
      passingMarks: "passingExceedsTotal",
    });
    expect(validateExamDraft({ ...valid, totalMarks: 0 })).toMatchObject({
      totalMarks: "totalInvalid",
    });
    expect(validateExamDraft({ ...valid, duration: 0 })).toMatchObject({
      duration: "durationInvalid",
    });
    expect(validateExamDraft({ ...valid, totalMarks: undefined })).toMatchObject({
      totalMarks: "totalInvalid",
    });
  });

  it("requires the name, date and at least one class", () => {
    expect(validateExamDraft({ ...valid, name: "  " })).toMatchObject({ name: "nameRequired" });
    expect(validateExamDraft({ ...valid, date: "" })).toMatchObject({ date: "dateRequired" });
    expect(validateExamDraft({ ...valid, classIds: [] })).toMatchObject({
      classIds: "classRequired",
    });
  });
});

describe("isExamDraftDirty", () => {
  it("is clean against the same persisted exam and dirty after an edit", () => {
    expect(isExamDraftDirty(valid, valid)).toBe(false);
    expect(isExamDraftDirty({ ...valid, passingMarks: 40 }, valid)).toBe(true);
    expect(isExamDraftDirty({ ...valid, classIds: ["c-2"] }, valid)).toBe(true);
  });
});
