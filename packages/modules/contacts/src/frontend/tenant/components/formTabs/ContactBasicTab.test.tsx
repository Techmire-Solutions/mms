import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactBasicTab } from "./ContactBasicTab.js";

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./ContactBasicAvatarSection.js", () => ({
  ContactBasicAvatarSection: () => <div data-testid="avatar-section">Avatar Section</div>,
}));

vi.mock("./ContactBasicIdentityFields.js", () => ({
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
