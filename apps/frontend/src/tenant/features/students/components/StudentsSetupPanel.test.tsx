import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_STUDENTS_SETTINGS } from "@mms/shared";
import { StudentsSetupPanel } from "./StudentsSetupPanel";

vi.mock("@/tenant/features/students/hooks/useStudentsSetupPanelState", () => ({
  useStudentsSetupPanelState: () => ({
    settingsDraft: DEFAULT_STUDENTS_SETTINGS,
    upd: vi.fn(),
    saved: false,
    saving: false,
    isDirty: false,
    isPrefsDirty: false,
    handleSave: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("StudentsSetupPanel Component", () => {
  it("renders preferences section and save footer", () => {
    const html = renderToStaticMarkup(<StudentsSetupPanel />);

    expect(html).toContain("students.settings.grSectionTitle");
    expect(html).toContain("common.save");
  });
});
