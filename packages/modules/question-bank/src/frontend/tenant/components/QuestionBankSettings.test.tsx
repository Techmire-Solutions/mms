import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionBankSettings } from "./QuestionBankSettings";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../hooks/useQuestionBankSetupPanelState", () => ({
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

vi.mock("@mms/ui", async (importOriginal: any) => {
  const actual = await (importOriginal as any)("@mms/ui");
  return {
    ...actual,

    SectionCard: ({ children, title }: { children: React.ReactNode; title: React.ReactNode }) => (
      <div data-testid="section-card">
        <h3>{title}</h3>
        {children}
      </div>
    ),
  };
});

vi.mock("@mms/fe-core/components/ModuleSetupSaveFooter", () => ({
  ModuleSetupSaveFooter: () => <div data-testid="save-footer">Save Footer</div>,
}));

vi.mock("./CategoryManager", () => ({
  CategoryManager: () => <div data-testid="category-manager">Category Manager</div>,
}));

describe("QuestionBankSettings Component", () => {
  it("renders section card and save footer", () => {
    const html = renderToStaticMarkup(<QuestionBankSettings />);
    expect(html).toContain("questionBank.settingsPrefsTitle");
    expect(html).toContain("Save Footer");
  });
});
