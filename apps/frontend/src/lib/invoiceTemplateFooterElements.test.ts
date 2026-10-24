import { DEFAULT_BRANDING_SETTINGS } from "@mms/shared";
import { describe, expect, it } from "vitest";
import { buildInvoiceTemplateFooterElements } from "./invoiceTemplateFooterElements";

describe("buildInvoiceTemplateFooterElements", () => {
  it("leaves unconfigured tenant contact details blank", () => {
    const elements = buildInvoiceTemplateFooterElements(DEFAULT_BRANDING_SETTINGS, "#000000");

    expect(elements.find((element) => element.id === "footer_address")?.label).toBe("");
    expect(elements.find((element) => element.id === "footer_contact")?.label).toBe("");
  });

  it("uses configured branding contact details", () => {
    const elements = buildInvoiceTemplateFooterElements(
      {
        ...DEFAULT_BRANDING_SETTINGS,
        phone: "+44 20 1234 5678",
        email: "accounts@school.org",
      },
      "#000000",
    );

    expect(elements.find((element) => element.id === "footer_contact")?.label).toBe(
      "Phone: +44 20 1234 5678   |   Email: accounts@school.org",
    );
  });
});
