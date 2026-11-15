import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@mms/shared";
import { validateCustomFieldValues } from "./validateCustomFieldValues";

const field = (patch: Partial<FieldDefinition>): FieldDefinition => ({
  key: "score",
  label: "Score",
  type: "number",
  enabled: true,
  order: 1,
  ...patch,
});

describe("validateCustomFieldValues", () => {
  it("reports required and type errors from the registry field metadata", () => {
    const errors = validateCustomFieldValues(
      [
        field({ key: "nickname", type: "text", required: true }),
        field({ key: "score", type: "number", required: true }),
        field({ key: "grade", type: "select", options: ["A", "B"] }),
      ],
      { nickname: "  ", score: "not-a-number", grade: "A" },
      "en",
    );

    expect(errors.nickname).toMatch(/required/i);
    expect(errors.score).toMatch(/number/i);
    expect(errors.grade).toBeUndefined();
  });

  it("accepts empty optional fields and valid values", () => {
    const errors = validateCustomFieldValues(
      [field({ key: "nickname", type: "text" }), field({ key: "score", type: "number" })],
      { nickname: "", score: "12" },
      "en",
    );

    expect(errors).toEqual({});
  });
});
