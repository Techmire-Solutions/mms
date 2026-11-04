import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES } from "@mms/shared";
import { ContactsPreferencesGeneralSection } from "./ContactsPreferencesGeneralSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ContactsPreferencesGeneralSection Component", () => {
  it("renders age and calendar toggles without redundant location inputs", () => {
    const html = renderToStaticMarkup(
      <ContactsPreferencesGeneralSection
        prefs={DEFAULT_CONTACT_PREFERENCES}
        onUpdatePreference={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.setup.generalPreferences");
    expect(html).toContain("contacts.setup.showDetailedSolarAge");
    expect(html).toContain("contacts.setup.showLunarDob");
    expect(html).toContain("contacts.setup.showDetailedLunarAge");
    expect(html).not.toContain("contacts.setup.defaultCountry");
  });
});
