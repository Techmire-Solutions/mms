import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactCardHeader } from "@/tenant/features/contacts/components/ContactCardHeader";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

const mockFemaleSyedContact: Contact = {
  id: "cnt-1",
  name: "Sayyida Fatima",
  firstName: "Sayyida",
  gender: "female",
  isSyed: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockMaleContact: Contact = {
  id: "cnt-2",
  name: "Ali Hassan",
  firstName: "Ali",
  gender: "male",
  isSyed: false,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactCardHeader", () => {
  it("renders display name and identity metadata by default when isColumnVisible is omitted", () => {
    const html = renderToStaticMarkup(
      <ContactCardHeader
        contact={mockFemaleSyedContact}
        isSelected={false}
        displayName="Sayyida Fatima"
        onSelect={vi.fn()}
      />,
    );

    expect(html).toContain("Sayyida Fatima");
    expect(html).toContain("contacts.table.yesSyed");
    expect(html).toContain("Female");
    expect(html).toContain('aria-label="contacts.table.selectContact:Sayyida Fatima"');
    expect(html).toContain('aria-label="contacts.table.viewProfile - Sayyida Fatima"');
  });

  it("renders display name and identity metadata when columns are explicitly visible", () => {
    const html = renderToStaticMarkup(
      <ContactCardHeader
        contact={mockFemaleSyedContact}
        isSelected={false}
        displayName="Sayyida Fatima"
        onSelect={vi.fn()}
        isColumnVisible={(key) => key === "gender" || key === "isSyed"}
      />,
    );

    expect(html).toContain("Sayyida Fatima");
    expect(html).toContain("contacts.table.yesSyed");
    expect(html).toContain("Female");
  });

  it("supports 'syed' column key alias for showing Syed badge", () => {
    const html = renderToStaticMarkup(
      <ContactCardHeader
        contact={mockFemaleSyedContact}
        isSelected={false}
        displayName="Sayyida Fatima"
        onSelect={vi.fn()}
        isColumnVisible={(key) => key === "syed"}
      />,
    );

    expect(html).toContain("Sayyida Fatima");
    expect(html).toContain("contacts.table.yesSyed");
    expect(html).not.toContain("Female");
  });

  it("renders Male badge and omits Syed badge for non-syed male contact", () => {
    const html = renderToStaticMarkup(
      <ContactCardHeader
        contact={mockMaleContact}
        isSelected={false}
        displayName="Ali Hassan"
        onSelect={vi.fn()}
        isColumnVisible={() => true}
      />,
    );

    expect(html).toContain("Ali Hassan");
    expect(html).toContain("Male");
    expect(html).not.toContain("contacts.table.yesSyed");
  });

  it("hides gender and syed badges when those columns are disabled", () => {
    const html = renderToStaticMarkup(
      <ContactCardHeader
        contact={mockFemaleSyedContact}
        isSelected={false}
        displayName="Sayyida Fatima"
        onSelect={vi.fn()}
        isColumnVisible={() => false}
      />,
    );

    expect(html).toContain("Sayyida Fatima");
    expect(html).not.toContain("contacts.table.yesSyed");
    expect(html).not.toContain("Female");
  });

  it("marks checkbox as checked when isSelected is true", () => {
    const html = renderToStaticMarkup(
      <ContactCardHeader
        contact={mockFemaleSyedContact}
        isSelected={true}
        displayName="Sayyida Fatima"
        onSelect={vi.fn()}
      />,
    );

    expect(html).toContain('aria-checked="true"');
  });

  it("renders avatar initials for contact", () => {
    const html = renderToStaticMarkup(
      <ContactCardHeader
        contact={mockFemaleSyedContact}
        isSelected={false}
        displayName="Sayyida Fatima"
        onSelect={vi.fn()}
      />,
    );

    expect(html).toContain("SF");
  });
});
