import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactExperienceTab } from "./ContactExperienceTab.js";

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./ContactSubListCards.js", () => ({
  ContactSubListShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sublist-shell">{children}</div>
  ),
  resolveSubListAllowAdd: () => true,
}));

vi.mock("./ContactExperienceEntryCard.js", () => ({
  ContactExperienceEntryCard: ({ exp }: { exp: { title?: string } }) => (
    <div data-testid="exp-entry">{exp.title}</div>
  ),
}));

describe("ContactExperienceTab Component", () => {
  it("renders experience tab entries", () => {
    const html = renderToStaticMarkup(
      <ContactExperienceTab
        contactDraft={{
          experience: [{ title: "Senior Lead", organization: "Tech Systems" }],
        }}
        getLocalId={() => "loc-1"}
        employmentTypeOptions={["Full-time", "Contract"]}
        formInstanceId="inst-1"
        getListItemError={() => undefined}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        fields={{}}
        addSubListItem={vi.fn()}
        ensureSubListItem={vi.fn()}
        updateSubListItem={vi.fn()}
        removeSubListItem={vi.fn()}
      />,
    );

    expect(html).toContain("Senior Lead");
  });
});
