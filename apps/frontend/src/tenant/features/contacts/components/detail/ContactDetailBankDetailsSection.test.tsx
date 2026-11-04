import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailBankDetailsSection } from "./ContactDetailBankDetailsSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockContactWithBank: Contact = {
  id: "cnt-1",
  name: "Ali Raza",
  firstName: "Ali",
  lastName: "Raza",
  bankDetails: [
    {
      id: "bnk-1",
      bankName: "Meezan Bank",
      accountTitle: "Syed Ali",
      accountNumber: "020202020202",
    },
  ],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockContactEmpty: Contact = {
  id: "cnt-2",
  name: "Zainab Bibi",
  firstName: "Zainab",
  bankDetails: [],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetailBankDetailsSection Component", () => {
  it("renders bank details with bank name, account title, and account number", () => {
    const html = renderToStaticMarkup(
      <ContactDetailBankDetailsSection contact={mockContactWithBank} />,
    );

    expect(html).toContain("Meezan Bank");
    expect(html).toContain("Syed Ali");
    expect(html).toContain("contacts.fields.bankAccountTitle");
    expect(html).toContain("020202020202");
    expect(html).toContain("contacts.fields.bankAccountNumber");
  });

  it("renders empty state message when no bank accounts exist", () => {
    const html = renderToStaticMarkup(
      <ContactDetailBankDetailsSection contact={mockContactEmpty} />,
    );

    expect(html).toContain("contacts.detail.emptyBankDetails");
  });
});
