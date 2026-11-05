import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactEmailsTab } from "./ContactEmailsTab";

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

describe("ContactEmailsTab Component", () => {
  it("renders labeled value sublist configured for emails", () => {
    const html = renderToStaticMarkup(
      <ContactEmailsTab
        contactDraft={{ emails: [] }}
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
        emailLabels={["personal", "work"]}
        onUpdateEmailLabels={vi.fn()}
      />,
    );

    expect(html).toContain("emails");
    expect(html).toContain("personal,work");
  });
});
