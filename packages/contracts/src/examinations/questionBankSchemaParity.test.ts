import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import type { QuestionBankQuestion } from "./questionBankEntityTypes.js";
import {
  type questionBankQuestionRecordSchema,
  questionBankQuestionWriteSchema,
} from "./questionBankModuleManifest.js";

type RecordDto = z.infer<typeof questionBankQuestionRecordSchema>;
type WriteDto = z.infer<typeof questionBankQuestionWriteSchema>;

describe("question schema/type parity", () => {
  it("keeps the static record type and the zod record schema identical", () => {
    expectTypeOf<QuestionBankQuestion>().toEqualTypeOf<RecordDto>();
    expect(true).toBe(true);
  });

  it("exposes a discriminated write payload", () => {
    // The union branch narrows on the discriminant.
    const assertNarrowing = (dto: WriteDto): void => {
      if (dto.type === "mcq") {
        expectTypeOf(dto.type).toEqualTypeOf<"mcq">();
      }
    };
    expect(assertNarrowing).toBeTypeOf("function");
  });

  it("rejects type-specific violations in the write schema", () => {
    const mcq = {
      id: "q-1",
      categoryIds: ["fiqh"],
      type: "mcq",
      difficulty: "easy",
      questionLanguage: "en",
      text: "Capital?",
      options: ["Cairo", "Giza"],
      answer: "Cairo",
    };
    expect(questionBankQuestionWriteSchema.safeParse(mcq).success).toBe(true);
    expect(questionBankQuestionWriteSchema.safeParse({ ...mcq, options: ["Cairo"] }).success).toBe(
      false,
    );
    expect(
      questionBankQuestionWriteSchema.safeParse({ ...mcq, answer: "Alexandria" }).success,
    ).toBe(false);
    expect(
      questionBankQuestionWriteSchema.safeParse({
        ...mcq,
        type: "short",
        options: ["Cairo"],
      }).success,
    ).toBe(false);
  });
});
