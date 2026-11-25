import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES } from "@mms/contracts";
import { ContactsPreferencesDuplicateSection } from "./ContactsPreferencesDuplicateSection.js";

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ContactsPreferencesDuplicateSection Component", () => {
  it("renders duplicate detection checkboxes and threshold inputs", () => {
    const html = renderToStaticMarkup(
      <ContactsPreferencesDuplicateSection
        prefs={DEFAULT_CONTACT_PREFERENCES}
        onUpdatePreference={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.setup.duplicateDetection");
    expect(html).toContain("contacts.setup.duplicateFields");
    expect(html).toContain("contacts.setup.duplicateThresholdHigh");
    expect(html).toContain("contacts.setup.duplicateThresholdMedium");
  });
});
