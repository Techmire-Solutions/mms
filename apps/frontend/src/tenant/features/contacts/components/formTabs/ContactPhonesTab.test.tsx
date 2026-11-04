import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactPhonesTab } from "./ContactPhonesTab";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./ContactLabeledValueSubListTab", () => ({
  ContactLabeledValueSubListTab: (props: { listKey: string; options: string[] }) => (
    <div data-testid="labeled-sublist">
      <span>{props.listKey}</span>
      <span>{props.options.join(",")}</span>
    </div>
  ),
}));

describe("ContactPhonesTab Component", () => {
  it("renders labeled value sublist configured for phones", () => {
    const html = renderToStaticMarkup(
      <ContactPhonesTab
        contactDraft={{ phones: [] }}
        getLocalId={() => "loc-1"}
        getListItemError={() => undefined}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        fields={{}}
        formInstanceId="inst-1"
        addSubListItem={vi.fn()}
        ensureSubListItem={vi.fn()}
        updateSubListItem={vi.fn()}
        removeSubListItem={vi.fn()}
        phoneLabels={["mobile", "home"]}
        onUpdatePhoneLabels={vi.fn()}
        defaultCountryCode="+92"
        countryCodeOptions={["+92", "+1"]}
        onUpdateDialCodeOptions={vi.fn()}
        handlePhoneBlur={vi.fn()}
      />,
    );

    expect(html).toContain("phones");
    expect(html).toContain("mobile,home");
  });
});
