import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES } from "@mms/contracts";
import { ContactsPreferencesSection } from "./ContactsPreferencesSection.js";

vi.mock("./ContactsPreferencesGeneralSection.js", () => ({
  ContactsPreferencesGeneralSection: () => <div data-testid="general-section">General Section</div>,
}));

vi.mock("./ContactsPreferencesDuplicateSection.js", () => ({
  ContactsPreferencesDuplicateSection: () => (
    <div data-testid="duplicate-section">Duplicate Section</div>
  ),
}));

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ContactsPreferencesSection Component", () => {
  it("renders both general and duplicate sections", () => {
    const html = renderToStaticMarkup(
      <ContactsPreferencesSection
        prefs={DEFAULT_CONTACT_PREFERENCES}
        isPrefsDirty={true}
        onUpdatePreference={vi.fn()}
      />,
    );

    expect(html).toContain("General Section");
    expect(html).toContain("Duplicate Section");
  });
});
