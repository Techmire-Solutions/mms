import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES } from "@mms/shared";
import { ContactsSetupPanel } from "./ContactsSetupPanel";

vi.mock("@/tenant/features/contacts/hooks/useContactsSetupPanelState", () => ({
  useContactsSetupPanelState: () => ({
    saved: false,
    prefs: DEFAULT_CONTACT_PREFERENCES,
    isSaving: false,
    isPrefsDirty: false,
    updatePreference: vi.fn(),
    handleSave: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/contacts/components/ContactsPreferencesSection", () => ({
  ContactsPreferencesSection: () => <div data-testid="prefs-section">Preferences Section</div>,
}));

describe("ContactsSetupPanel Component", () => {
  it("renders preferences section and save footer", () => {
    const html = renderToStaticMarkup(<ContactsSetupPanel />);

    expect(html).toContain("Preferences Section");
    expect(html).toContain("contacts.setup.saveAndApply");
  });
});
