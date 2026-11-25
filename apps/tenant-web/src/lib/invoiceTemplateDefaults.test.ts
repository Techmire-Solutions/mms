import { describe, expect, it, vi, beforeEach } from "vitest";
import { getDefaultTemplate } from "@/lib/invoiceTemplateDefaults";
import { getInvoiceTemplateBranding } from "@/lib/invoiceTemplateBranding";
import { buildDefaultInvoiceTemplateElements } from "@/lib/invoiceTemplateElements";

vi.mock("@/lib/invoiceTemplateBranding", () => ({
  getInvoiceTemplateBranding: vi.fn(),
}));

vi.mock("@/lib/invoiceTemplateElements", () => ({
  buildDefaultInvoiceTemplateElements: vi.fn(),
}));

const mockedBranding = vi.mocked(getInvoiceTemplateBranding);
const mockedElements = vi.mocked(buildDefaultInvoiceTemplateElements);

describe("getDefaultTemplate", () => {
  beforeEach(() => {
    mockedBranding.mockReset();
    mockedElements.mockReset();
  });

  it("builds an A6 template from branding and default elements", () => {
    mockedBranding.mockReturnValue({ primary: "#123456" } as never);
    mockedElements.mockReturnValue([{ id: "el1" }] as never);

    const template = getDefaultTemplate();
    expect(template.pageSize).toBe("A6");
    expect(template.elements).toEqual([{ id: "el1" }]);
    expect(mockedBranding).toHaveBeenCalled();
    expect(mockedElements).toHaveBeenCalledWith({ primary: "#123456" }, undefined);
  });
});
