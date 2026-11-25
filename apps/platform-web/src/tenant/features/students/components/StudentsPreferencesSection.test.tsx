import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_STUDENTS_SETTINGS } from "@mms/contracts";
import { StudentsPreferencesSection } from "./StudentsPreferencesSection";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("StudentsPreferencesSection Component", () => {
  it("renders student GR number sequence configuration with live preview", () => {
    const html = renderToStaticMarkup(
      <StudentsPreferencesSection settingsDraft={DEFAULT_STUDENTS_SETTINGS} upd={vi.fn()} />,
    );

    expect(html).toContain("students.settings.grSectionTitle");
    expect(html).toContain("students.settings.autoGenerateId");
    expect(html).toContain("students.settings.grDigits");
    expect(html).toContain("common.sequenceNumbering.preview");
    expect(html).toContain("common.sequenceNumbering.startLabel");
    expect(html).toContain("common.sequenceNumbering.lastIssued");
  });
});
