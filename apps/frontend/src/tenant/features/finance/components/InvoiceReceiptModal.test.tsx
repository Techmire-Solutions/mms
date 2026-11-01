import React, { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentTemplate } from "@mms/shared";
import { createRoot } from "react-dom/client";
import type { Invoice } from "@/lib/data/financeData";
import { InvoiceReceiptModal } from "./InvoiceReceiptModal";
import { writeCachedDocumentTemplate } from "@/lib/templates/documentTemplateCache";
import { fetchDocumentTemplateServer } from "@/lib/templates/documentTemplatesApi";
import { FINANCE_TEMPLATE_STORAGE_KEY } from "../lib/financeTemplateData";
import { notify } from "@/lib/notify";
import { withQueryClient } from "@/test/queryClientTestUtils";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en", isRtl: false }),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({ madrasaName: "Test Madrasa", logoUrl: null }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/templates/documentTemplatesApi", () => ({
  fetchDocumentTemplateServer: vi.fn().mockResolvedValue(null),
  saveDocumentTemplateServer: vi.fn().mockImplementation(async (_key, template) => template),
  deleteDocumentTemplateServer: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/components/app/Modal", () => ({
  Modal: ({
    children,
    headerActions,
  }: {
    children?: React.ReactNode;
    headerActions?: React.ReactNode;
  }) => (
    <div data-testid="modal">
      {headerActions}
      {children}
    </div>
  ),
}));

function invoice(id: string): Invoice {
  return {
    id,
    studentId: `stu-${id}`,
    studentName: "Zaid Khan",
    class: "Class 1",
    session: "Morning",
    baseFee: 500,
    discountValue: 0,
    discountAmt: 0,
    finalAmt: 500,
    status: "paid",
    dueDate: "2026-01-01",
    paidDate: "2026-01-02",
    method: "Cash",
    invoiceNumber: `INV-${id}`,
    lines: [{ id: "l1", description: "Tuition", quantity: 1, amount: 500, discountAmt: 0 }],
  } as Invoice;
}

function fakePrintWindow() {
  return {
    opener: null as unknown,
    document: { write: vi.fn(), close: vi.fn() },
    addEventListener: vi.fn(),
    focus: vi.fn(),
    print: vi.fn(),
  };
}

async function renderModal(invoices: Invoice[]): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(withQueryClient(<InvoiceReceiptModal invoices={invoices} onClose={vi.fn()} />));
  });
  return container;
}

describe("InvoiceReceiptModal", () => {
  const customTemplate: DocumentTemplate = {
    pageSize: "A6",
    orientation: "portrait",
    elements: [
      { id: "custom", type: "static", label: "CUSTOM RECEIPT", x: 10, y: 10, w: 200, h: 20 },
      {
        id: "student",
        type: "field",
        field: "studentName",
        label: "Student",
        x: 10,
        y: 40,
        w: 200,
        h: 20,
      },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(fetchDocumentTemplateServer).mockResolvedValue(customTemplate as never);
    writeCachedDocumentTemplate(FINANCE_TEMPLATE_STORAGE_KEY, customTemplate);
  });

  it("renders the saved receipt layout for every selected invoice", async () => {
    const container = await renderModal([invoice("1"), invoice("2")]);

    const labelCount = (container.textContent?.match(/CUSTOM RECEIPT/g) ?? []).length;
    // One visible page per invoice plus the offscreen print copy of each.
    expect(labelCount).toBe(4);
    expect(container.textContent).toContain("Zaid Khan");
  });

  it("prints the rendered template, not a hardcoded receipt", async () => {
    const win = fakePrintWindow();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    const container = await renderModal([invoice("1")]);

    const printButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("finance.printReceipt"),
    );
    expect(printButton).toBeTruthy();

    await act(async () => {
      printButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const written = win.document.write.mock.calls[0]?.[0] as string;
    expect(written).toContain("CUSTOM RECEIPT");
    expect(written).toContain("@page { size: 397px 559px portrait; margin: 0; }");
    openSpy.mockRestore();
  });

  it("reports a blocked print popup", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const container = await renderModal([invoice("1")]);

    const printButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("finance.printReceipt"),
    );
    await act(async () => {
      printButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(notify.error).toHaveBeenCalledWith("templateEditor.exportFailed");
    openSpy.mockRestore();
  });
});
