import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/contracts";
import { ConfidenceBadge, DuplicateContactCard } from "./DuplicateDetectionParts.js";

vi.mock(
  "@mms/mod-contacts/frontend/tenant/components/ContactConfigContext",
  async (importOriginal) => ({
    ...((await importOriginal()) as Record<string, unknown>),
    useContactConfig: () => ({
      prefs: {
        duplicateDetectionFields: ["name", "phone"],
      },
    }),
  }),
);

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  phone: "+92 300 1234567",
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("DuplicateDetectionParts Components", () => {
  it("renders ConfidenceBadge correctly", () => {
    const html = renderToStaticMarkup(<ConfidenceBadge score={95} prefs={{}} />);
    expect(html).toContain("95");
    expect(html).toContain("contacts.duplicates.matchSuffix");
  });

  it("renders DuplicateContactCard correctly", () => {
    const html = renderToStaticMarkup(
      <DuplicateContactCard
        contact={mockContact}
        selected={true}
        onSelect={vi.fn()}
        label="Contact A"
      />,
    );
    expect(html).toContain("Contact A");
    expect(html).toContain("Zayd Harith");
  });
});
