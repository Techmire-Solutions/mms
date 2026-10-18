import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  coercePaperNumberInput,
  createPaperDraftFromTest,
  escapeHtml,
  getPaperQuestionCount,
  getPaperQuestionIds,
  normalizePaperSections,
  type PaperSection,
} from "@/tenant/features/question-bank/components/paperBuilderUtils";

const sections: PaperSection[] = [
  { id: "section-a", title: "A", instructions: "", questionIds: ["q1", "q2"] },
  { id: "section-b", title: "B", instructions: "", questionIds: ["q3"] },
];

describe("paperBuilderUtils", () => {
  it("coerces numeric form values without allowing invalid paper settings", () => {
    expect(coercePaperNumberInput("45", 30, 5)).toBe(45);
    expect(coercePaperNumberInput("12.8", 30, 5)).toBe(12);
    expect(coercePaperNumberInput("2", 30, 5)).toBe(5);
    expect(coercePaperNumberInput("", 30, 5)).toBe(30);
    expect(coercePaperNumberInput("abc", 30, 5)).toBe(30);
  });

  it("derives flattened paper question ids and counts from sections", () => {
    expect(getPaperQuestionIds(sections)).toEqual(["q1", "q2", "q3"]);
    expect(getPaperQuestionCount(sections)).toBe(3);
  });

  it("normalizes paper sections before persistence", () => {
    expect(
      normalizePaperSections([
        { id: "section-a", title: "  ", instructions: "  Read carefully  ", questionIds: ["q1", ""] },
        { id: "section-b", title: "  Essay  ", instructions: "  ", questionIds: [] },
      ]),
    ).toEqual([
      { id: "section-a", title: "Section 1", instructions: "Read carefully", questionIds: ["q1"] },
    ]);
  });

  it("creates a paper builder draft from saved paper metadata", () => {
    const draft = createPaperDraftFromTest(
      {
        id: "paper-1",
        name: "Monthly Paper",
        categoryId: null,
        difficulty: "mixed",
        questionIds: ["q1", "q2"],
        duration: 45,
        createdAt: "2026-06-27T10:00:00.000Z",
        examClass: "Hifz 2",
        totalMarks: 50,
        instructions: "Answer all.",
        sections: [
          { id: "section-a", title: "  Part A  ", instructions: "  MCQ  ", questionIds: ["q1"] },
          { id: "section-b", title: "", instructions: "", questionIds: ["q2"] },
        ],
      },
      (sectionNumber) => `Part ${sectionNumber}`,
    );

    expect(draft).toEqual({
      config: {
        name: "Monthly Paper",
        examClass: "Hifz 2",
        classId: "",
        totalMarks: 50,
        duration: 45,
        instructions: "Answer all.",
      },
      sections: [
        { id: "section-a", title: "Part A", instructions: "MCQ", questionIds: ["q1"] },
        { id: "section-b", title: "Part 2", instructions: "", questionIds: ["q2"] },
      ],
    });
  });

  it("creates a draft for older flat test records without sections", () => {
    expect(
      createPaperDraftFromTest(
        {
          id: "test-1",
          name: "Old Paper",
          categoryId: null,
          difficulty: "mixed",
          questionIds: ["q1", "q2"],
          duration: 30,
          createdAt: "2026-06-27T10:00:00.000Z",
        },
        (sectionNumber) => `Section ${sectionNumber}`,
      ).sections,
    ).toEqual([
      { id: "test-1-section-1", title: "Section 1", instructions: "", questionIds: ["q1", "q2"] },
    ]);
  });

  it("escapes printable document titles before writing print HTML", () => {
    expect(escapeHtml(`A&B <Paper> "Final" 'One'`)).toBe(
      "A&amp;B &lt;Paper&gt; &quot;Final&quot; &#039;One&#039;",
    );
  });

  /**
   * Source-read ratchet: guards the print-script contract in openPaperPrintWindow.
   * Same technique as printStyles.test.ts — reads the source so the test runs
   * without a real DOM and catches regressions in the generated HTML string.
   */
  describe("openPaperPrintWindow print-script contract", () => {
    const src = readFileSync(
      path.resolve(import.meta.dirname, "./paperBuilderUtils.ts"),
      "utf-8",
    );

    it("uses document.fonts.ready instead of a fixed setTimeout for print", () => {
      expect(src).toContain("document.fonts.ready");
      expect(src).not.toMatch(/setTimeout[^)]*window\.print/);
    });

    it("closes via onafterprint rather than a timed setTimeout", () => {
      expect(src).toContain("window.onafterprint");
      expect(src).not.toMatch(/setTimeout[^)]*window\.close/);
    });
  });
});
