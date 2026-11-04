import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactSocialsTab } from "./ContactSocialsTab";

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

describe("ContactSocialsTab Component", () => {
  it("renders labeled value sublist configured for socials", () => {
    const html = renderToStaticMarkup(
      <ContactSocialsTab
        contactDraft={{ socials: [] }}
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
        socialPlatforms={["twitter", "github"]}
        onUpdateSocialPlatforms={vi.fn()}
      />,
    );

    expect(html).toContain("socials");
    expect(html).toContain("twitter,github");
  });
});
