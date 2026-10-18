import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionBankSettings } from "./QuestionBankSettings";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/question-bank/hooks/useQuestionBankSetupPanelState", () => ({
  useQuestionBankSetupPanelState: () => ({
    settingsDraft: {
      aiGrading: false,
      defaultTestDuration: 30,
      categories: [],
      questionTypes: [{ id: "mcq", enabled: true }],
      difficultyLevels: [{ id: "easy", enabled: true }],
    },
    saved: true,
    saving: false,
    isPrefsDirty: false,
    isDirty: false,
    upd: vi.fn(),
    handleSave: vi.fn(),
  }),
}));

vi.mock("@/components/app/SectionCard", () => ({
  SectionCard: ({ children, title }: { children: React.ReactNode; title: React.ReactNode }) => (
    <div data-testid="section-card">
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

vi.mock("@/components/app/ModuleSetupSaveFooter", () => ({
  ModuleSetupSaveFooter: () => <div data-testid="save-footer">Save Footer</div>,
}));

vi.mock("@/tenant/features/question-bank/components/CategoryManager", () => ({
  CategoryManager: () => <div data-testid="category-manager">Category Manager</div>,
}));

describe("QuestionBankSettings Component", () => {
  it("renders section card and save footer", () => {
    const html = renderToStaticMarkup(<QuestionBankSettings />);
    expect(html).toContain("questionBank.settingsPrefsTitle");
    expect(html).toContain("Save Footer");
  });
});
