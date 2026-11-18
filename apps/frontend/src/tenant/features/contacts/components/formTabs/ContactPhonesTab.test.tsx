import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactPhonesTab } from "./ContactPhonesTab";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

let capturedSubListProps: Record<string, unknown> | null = null;

vi.mock("./ContactLabeledValueSubListTab", () => ({
  ContactLabeledValueSubListTab: (props: Record<string, unknown>) => {
    capturedSubListProps = props;
    return (
      <div data-testid="labeled-sublist">
        <span>{String(props.listKey)}</span>
        <span>{(props.options as string[]).join(",")}</span>
      </div>
    );
  },
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

  it("generates stable unique UUID id for each newly added phone item", () => {
    expect(capturedSubListProps).not.toBeNull();
    const emptyItem = capturedSubListProps?.emptyItem as (label: string) => Record<string, unknown>;
    expect(typeof emptyItem).toBe("function");

    const phone1 = emptyItem("Mobile");
    const phone2 = emptyItem("Work");

    expect(typeof phone1.id).toBe("string");
    expect((phone1.id as string).length).toBeGreaterThan(0);
    expect(typeof phone2.id).toBe("string");
    expect((phone2.id as string).length).toBeGreaterThan(0);
    // Distinct items must each have their own stable unique id
    expect(phone1.id).not.toBe(phone2.id);
    expect(phone1.countryCode).toBe("+92");
    expect(phone1.number).toBe("");
  });
});
