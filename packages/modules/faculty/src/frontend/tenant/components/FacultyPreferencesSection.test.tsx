import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_FACULTY_SETTINGS } from "@mms/contracts";
import { FacultyPreferencesSection } from "./FacultyPreferencesSection";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("FacultyPreferencesSection Component", () => {
  it("renders employee ID sequence configuration with save footer", () => {
    const html = renderToStaticMarkup(
      <FacultyPreferencesSection settingsDraft={DEFAULT_FACULTY_SETTINGS} upd={vi.fn()} />,
    );

    expect(html).toContain("faculty.settings.idSectionTitle");
    expect(html).toContain("faculty.settings.idPrefix");
    expect(html).toContain("faculty.settings.autoGenerateId");
    expect(html).toContain("common.sequenceNumbering.preview");
    expect(html).toContain("common.sequenceNumbering.template");
    expect(html).toContain("common.sequenceNumbering.digits");
    expect(html).toContain("common.sequenceNumbering.startLabel");
    expect(html).toContain("common.sequenceNumbering.lastIssued");
    expect(html).not.toContain("faculty.settings.registrationGovernance");
    expect(html).not.toContain("faculty.settings.requireContactLink");
    expect(html).not.toContain("faculty.settings.defaultSpecialization");
    expect(html).toContain("faculty.settings.contactRequirementsTitle");
    expect(html).toContain("faculty.settings.requireContactPhone");
    expect(html).toContain("faculty.settings.requireContactEmail");
    expect(html).toContain("common.save");
  });
});
