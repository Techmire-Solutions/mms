import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactBasicTab } from "./ContactBasicTab";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/contacts/components/formTabs/ContactBasicAvatarSection", () => ({
  ContactBasicAvatarSection: () => <div data-testid="avatar-section">Avatar Section</div>,
}));

vi.mock("@/tenant/features/contacts/components/formTabs/ContactBasicIdentityFields", () => ({
  ContactBasicIdentityFields: () => <div data-testid="identity-fields">Identity Fields</div>,
}));

describe("ContactBasicTab Component", () => {
  it("renders basic info sections", () => {
    const html = renderToStaticMarkup(
      <ContactBasicTab
        contactDraft={{ firstName: "Zayd", lastName: "Harith" }}
        formInstanceId="inst-1"
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        getFieldError={() => undefined}
        updateDraft={vi.fn()}
        cropSrc={null}
        setCropSrc={vi.fn()}
        genders={["male", "female"]}
        onUpdateGenders={vi.fn()}
        lockGender={false}
        handleAvatarChange={vi.fn()}
      />,
    );

    expect(html).toContain("Avatar Section");
    expect(html).toContain("Identity Fields");
  });
});
