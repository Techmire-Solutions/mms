import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES } from "@mms/shared";
import { ContactsPreferencesSection } from "./ContactsPreferencesSection";

vi.mock("@/tenant/features/contacts/components/ContactsPreferencesGeneralSection", () => ({
  ContactsPreferencesGeneralSection: () => <div data-testid="general-section">General Section</div>,
}));

vi.mock("@/tenant/features/contacts/components/ContactsPreferencesDuplicateSection", () => ({
  ContactsPreferencesDuplicateSection: () => (
    <div data-testid="duplicate-section">Duplicate Section</div>
  ),
}));

vi.mock("@/hooks/useTranslation", () => ({
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
