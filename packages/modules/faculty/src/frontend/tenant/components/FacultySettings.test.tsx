import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_FACULTY_SETTINGS } from "@mms/contracts";
import { FacultySettings } from "./FacultySettings";

vi.mock("../hooks/usePermissions", () => ({
  useModulePermissions: () => ({ canEditSetup: true }),
}));

vi.mock("../hooks/useFacultyStatusConfig", () => ({
  useFacultyLookupOptions: () => ({
    specializationOptions: ["Tajweed", "Hifz"],
  }),
}));

vi.mock("../hooks/useFacultySetupPanelState", () => ({
  useFacultySetupPanelState: () => ({
    settingsDraft: DEFAULT_FACULTY_SETTINGS,
    saved: false,
    saving: false,
    isPrefsDirty: false,
    upd: vi.fn(),
    handleSave: vi.fn(),
  }),
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("FacultySettings Component", () => {
  it("renders preferences only (catalogs live under Work sub-tabs)", () => {
    const html = renderToStaticMarkup(<FacultySettings />);

    expect(html).toContain("faculty.settings.idSectionTitle");
    expect(html).not.toContain("faculty.settings.registrationGovernance");
    expect(html).toContain("common.save");
    expect(html).not.toContain("faculty.designations.setupTitle");
    expect(html).not.toContain("faculty.setup.departmentsTitle");
  });
});
