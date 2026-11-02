import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceTemplateEditor } from "./InvoiceTemplateEditor";
import { withQueryClient } from "@/test/queryClientTestUtils";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({
    logoUrl: "https://example.com/logo.png",
    primaryColor: "#059669",
    secondaryColor: "#047857",
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/templates/documentTemplatesApi", () => ({
  fetchDocumentTemplateServer: vi.fn().mockResolvedValue(null),
  saveDocumentTemplateServer: vi.fn().mockImplementation(async (_key, template) => ({
    template,
    updatedAt: "2026-01-01T00:00:00.000Z",
  })),
}));

vi.mock("@/lib/invoiceTemplateStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/invoiceTemplateStore")>();
  return {
    ...actual,
    saveTemplate: vi.fn(),
  };
});

const mockUseMergedObligationContacts = vi.fn((ids: unknown[]) =>
  Array.isArray(ids) && ids.length > 0
    ? [
        { id: "c1", name: "Fatima Zahra", phone: "+92 300 0000000", email: "fatima@example.com" },
        { id: "c2", name: "Sayyid Kazim", phone: "+92 321 0000000", email: "kazim@example.com" },
      ]
    : [],
);

vi.mock("@/tenant/features/obligations/hooks/useObligationLookups", () => ({
  useMergedObligationContacts: (ids: unknown[]) => mockUseMergedObligationContacts(ids),
  useMergedObligationUsers: (ids: unknown[]) =>
    Array.isArray(ids) && ids.length > 0 ? [{ id: "u1", name: "Staff Member" }] : [],
}));

describe("InvoiceTemplateEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the editor with title, default sample values, and all presets", () => {
    const html = renderToStaticMarkup(withQueryClient(<InvoiceTemplateEditor onClose={vi.fn()} />));

    expect(html).toContain("obligations.templateEditorTitle");
    expect(html).toContain("obligations.invoiceTemplate.presetClassic");
    expect(html).toContain("obligations.invoiceTemplate.presetThermal");
    expect(html).toContain("obligations.invoiceTemplate.presetFormal");
    expect(html).toContain("obligations.invoiceTemplate.presetModern");
    expect(html).toContain("REC-2026-0042");
  });

  it("renders export actions for Typst and Zoho in toolbar", () => {
    const html = renderToStaticMarkup(withQueryClient(<InvoiceTemplateEditor onClose={vi.fn()} />));

    expect(html).toContain("Typst");
    expect(html).toContain("Zoho");
  });

  it("resolves relational contact and user lookups into live preview markup", () => {
    const mockCollection = {
      id: "col-123",
      receipt_no: "REC-LIVE-9999",
      received_date: "2026-09-13",
      sender_id: "c1",
      reference_id: "c2",
      obligation_type_id: "ot-khums",
      amount: "150000.00",
      currency_id: "PKR",
      payment_mode: "Cash",
      received_by: "u1",
    } as unknown as Parameters<typeof InvoiceTemplateEditor>[0]["collection"];

    const html = renderToStaticMarkup(
      withQueryClient(<InvoiceTemplateEditor collection={mockCollection} onClose={vi.fn()} />),
    );

    expect(html).toContain("REC-LIVE-9999");
    expect(html).toContain("Fatima Zahra");
  });

  it("renders gracefully when collection contains null optional fields", () => {
    const nullableCollection = {
      id: "col-456",
      receipt_no: "REC-NULL-0001",
      received_date: "2026-09-13",
      sender_id: "c1",
      reference_id: null,
      obligation_type_id: "ot-general",
      amount: "5000.00",
      currency_id: "PKR",
      payment_mode: "Cash",
      received_by: "u1",
    } as unknown as Parameters<typeof InvoiceTemplateEditor>[0]["collection"];

    const html = renderToStaticMarkup(
      withQueryClient(<InvoiceTemplateEditor collection={nullableCollection} onClose={vi.fn()} />),
    );

    expect(html).toContain("REC-NULL-0001");
    expect(html).toContain("Fatima Zahra");
  });

  it("renders embedded mode with region accessibility landmark when fullscreen is false", () => {
    const html = renderToStaticMarkup(
      withQueryClient(<InvoiceTemplateEditor fullscreen={false} onClose={vi.fn()} />),
    );

    expect(html).toContain('role="region"');
    expect(html).toContain("obligations.templateEditorTitle");
    expect(html).not.toContain('role="dialog"');
  });

  it("does not query contact lookups when collection is null", () => {
    mockUseMergedObligationContacts.mockClear();
    renderToStaticMarkup(withQueryClient(<InvoiceTemplateEditor onClose={vi.fn()} />));
    expect(mockUseMergedObligationContacts).toHaveBeenCalledWith([]);
  });

  it("renders modal dialog landmark when fullscreen is true", () => {
    const html = renderToStaticMarkup(
      withQueryClient(<InvoiceTemplateEditor fullscreen={true} onClose={vi.fn()} />),
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });
});
