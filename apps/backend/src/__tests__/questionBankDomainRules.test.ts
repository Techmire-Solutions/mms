import { describe, expect, it } from "vitest";
import {
  assertPaperCompositionEditable,
  assertQuestionEditable,
  assertQuestionTransition,
  illegalQuestionTransitionError,
  questionContentLockedError,
  questionInUseError,
} from "../questionBank/domain/questionWriteGuards.js";
import { scoreAssessment, scoreQuestionAnswer } from "../questionBank/domain/questionScoring.js";

/** Domain-rule regression suite (questionBank/domain) — no database required. */

function expectConflict(run: () => void, type: string): void {
  try {
    run();
    throw new Error("expected the guard to throw");
  } catch (error) {
    expect(error).toMatchObject({ statusCode: 409, type });
  }
}

describe("question write guards", () => {
  it("allows metadata-only edits at any status", () => {
    expect(() =>
      assertQuestionEditable(
        { id: "q1", status: "approved", referenced: true },
        {
          contentChanged: false,
        },
      ),
    ).not.toThrow();
  });

  it("locks content edits on approved and retired questions", () => {
    expectConflict(
      () =>
        assertQuestionEditable(
          { id: "q1", status: "approved", referenced: false },
          {
            contentChanged: true,
          },
        ),
      "question_locked",
    );
    expectConflict(
      () =>
        assertQuestionEditable(
          { id: "q1", status: "retired", referenced: false },
          {
            contentChanged: true,
          },
        ),
      "question_locked",
    );
  });

  it("allows content edits while drafting or in review", () => {
    for (const status of ["draft", "under_review"]) {
      expect(() =>
        assertQuestionEditable({ id: "q1", status, referenced: false }, { contentChanged: true }),
      ).not.toThrow();
    }
  });

  it("blocks a content edit once a delivered paper references the question", () => {
    expectConflict(
      () =>
        assertQuestionEditable(
          { id: "q1", status: "draft", referenced: true },
          {
            contentChanged: true,
          },
        ),
      "question_in_use",
    );
  });

  it("rejects illegal transitions and referenced reopenings", () => {
    expectConflict(
      () =>
        assertQuestionTransition({ id: "q1", from: "draft", to: "approved", referenced: false }),
      "illegal_question_transition",
    );
    expectConflict(
      () =>
        assertQuestionTransition({ id: "q1", from: "under_review", to: "draft", referenced: true }),
      "question_in_use",
    );
  });

  it("permits retiring a referenced question and the normal review path", () => {
    expect(() =>
      assertQuestionTransition({ id: "q1", from: "approved", to: "retired", referenced: true }),
    ).not.toThrow();
    expect(() =>
      assertQuestionTransition({ id: "q1", from: "draft", to: "under_review", referenced: false }),
    ).not.toThrow();
  });

  it("freezes paper composition only once published", () => {
    expect(() =>
      assertPaperCompositionEditable({ testId: "t1", publishedAt: null, compositionChanged: true }),
    ).not.toThrow();
    expectConflict(
      () =>
        assertPaperCompositionEditable({
          testId: "t1",
          publishedAt: new Date(),
          compositionChanged: true,
        }),
      "paper_locked",
    );
    // Metadata-only paper edits stay legal after publication.
    expect(() =>
      assertPaperCompositionEditable({
        testId: "t1",
        publishedAt: new Date(),
        compositionChanged: false,
      }),
    ).not.toThrow();
  });

  it("names the question and the reason in the error payload", () => {
    expect(questionContentLockedError("q9", "approved")).toMatchObject({
      type: "question_locked",
      details: { questionId: "q9", status: "approved" },
    });
    expect(questionInUseError("q9", "editing it")).toMatchObject({ type: "question_in_use" });
    expect(illegalQuestionTransitionError("q9", "retired", "under_review")).toMatchObject({
      type: "illegal_question_transition",
      details: { from: "retired", to: "under_review" },
    });
  });
});

describe("server-side scoring", () => {
  const mcq = {
    id: "q1",
    type: "mcq" as const,
    options: ["4", "5"],
    answer: "4",
    marks: 2,
  };
  const numeric = {
    id: "q2",
    type: "numeric" as const,
    options: ["0.5"],
    answer: "10",
    marks: 3,
  };
  const short = {
    id: "q3",
    type: "short" as const,
    options: [] as string[],
    answer: "Four",
    marks: 1,
  };

  it("awards full marks for a correct answer and zero otherwise", () => {
    expect(scoreQuestionAnswer(mcq, "4")).toBe(2);
    expect(scoreQuestionAnswer(mcq, "5")).toBe(0);
    expect(scoreQuestionAnswer(mcq, undefined)).toBe(0);
    expect(scoreQuestionAnswer(numeric, "10.4")).toBe(3);
    expect(scoreQuestionAnswer(numeric, "12")).toBe(0);
    expect(scoreQuestionAnswer(short, "four")).toBe(1);
  });

  it("preserves the answer key's marks for every question on the paper", () => {
    const { scores, total } = scoreAssessment([mcq, numeric, short], {
      q1: "4",
      q2: "9.5",
      q3: "four",
    });
    expect(scores).toEqual({ q1: 2, q2: 3, q3: 1 });
    expect(total).toBe(6);
  });

  it("ignores unknown question ids and missing answers", () => {
    const { scores, total } = scoreAssessment([mcq], { q1: "4", q99: "anything" });
    expect(scores).toEqual({ q1: 2 });
    expect(total).toBe(2);
    expect(scoreAssessment([mcq], {}).total).toBe(0);
  });

  it("never awards more than the question's marks", () => {
    const { total } = scoreAssessment([{ ...mcq, marks: 1 }], { q1: "4" });
    expect(total).toBe(1);
  });
});
