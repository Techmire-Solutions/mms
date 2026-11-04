import { describe, expect, it } from "vitest";
import type { Student } from "@mms/shared";
import { getInitialStudentDraft } from "./studentFormDraft";
import { prepareStudentForSave } from "@/tenant/features/students/hooks/studentFormValidation";

/** A Work-directory row: the list projection deliberately omits `notes`. */
function listRow(overrides: Partial<Student> = {}): Partial<Student> {
  return {
    id: "st-1",
    contactId: "c-1",
    name: "Aisha",
    grNumber: "GR-1",
    status: "active",
    ...overrides,
  };
}

describe("student form draft", () => {
  it("does not materialise an empty notes value for a row that omits notes", () => {
    // 2026-11-04 review (M2): the draft forced `notes: ""` for every list row, and the
    // server merge only skips `undefined`, so any edit from the directory wiped notes.
    const draft = getInitialStudentDraft(listRow());

    expect(draft.notes).toBeUndefined();
  });

  it("keeps a hydrated notes value", () => {
    const draft = getInitialStudentDraft(listRow({ notes: "Needs a guardian call" }));

    expect(draft.notes).toBe("Needs a guardian call");
  });

  it("omits notes from the write payload when the row was not hydrated", () => {
    const payload = prepareStudentForSave({
      data: getInitialStudentDraft(listRow()),
      enrolledSessions: [],
    });

    expect(payload).not.toHaveProperty("notes");
  });
});
