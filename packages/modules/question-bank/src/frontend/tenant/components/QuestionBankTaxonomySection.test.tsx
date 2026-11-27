import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionBankTaxonomySection } from "./QuestionBankTaxonomySection";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("QuestionBankTaxonomySection", () => {
  it("renders question type and difficulty level buttons", () => {
    const html = renderToStaticMarkup(
      <QuestionBankTaxonomySection
        questionTypes={[
          { id: "mcq", enabled: true },
          { id: "short", enabled: false },
        ]}
        difficultyLevels={[
          { id: "easy", enabled: true },
          { id: "hard", enabled: false },
        ]}
        onToggleQuestionType={vi.fn()}
        onToggleDifficulty={vi.fn()}
      />,
    );

    expect(html).toContain("questionBank.typesTitle");
    expect(html).toContain("questionBank.type.mcq");
    expect(html).toContain("questionBank.type.short");
    expect(html).toContain("questionBank.difficultiesTitle");
    expect(html).toContain("questionBank.difficulty.easy");
    expect(html).toContain("questionBank.difficulty.hard");
  });
});
