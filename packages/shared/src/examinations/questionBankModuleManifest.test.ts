import { describe, expect, it } from "vitest";
import { questionBankTestRecordSchema } from "./questionBankModuleManifest.js";

describe("questionBankTestRecordSchema", () => {
  it("accepts manual paper-builder metadata for persistence in tests.custom_data", () => {
    const paper = {
      id: "paper-1",
      name: "Manual Paper",
      categoryId: null,
      questionIds: ["q-1", "q-2"],
      difficulty: "mixed",
      duration: 45,
      createdAt: "2026-06-27T10:00:00.000Z",
      examClass: "Hifz Level 2",
      totalMarks: 100,
      instructions: "Answer all questions.",
      sections: [
        {
          id: "section-a",
          title: "Part A",
          instructions: "Choose the correct answer.",
          questionIds: ["q-1"],
        },
        {
          id: "section-b",
          title: "Part B",
          instructions: "Write short answers.",
          questionIds: ["q-2"],
        },
      ],
    };

    expect(questionBankTestRecordSchema.parse(paper)).toEqual(paper);
  });
});
