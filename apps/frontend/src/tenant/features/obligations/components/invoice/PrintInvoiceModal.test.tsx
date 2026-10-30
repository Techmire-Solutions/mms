import React, { act } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { PrintInvoiceModal } from "./PrintInvoiceModal";
import type { ObligationCollection } from "@/lib/data/obligationsData";
import { notify } from "@/lib/notify";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.number) return `${key}:${params.number}`;
      return key;
    },
    language: "en",
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({
    institutionName: "Madrasa Al-Huda",
    tagline: "",
    address: "123 Main St",
    contactPhone: "+923001234567",
    contactEmail: "info@example.com",
    logoUrl: "",
    currency: "PKR",
    themeColor: "#059669",
  }),
}));

vi.mock("@/tenant/features/obligations/hooks/useObligationLookups", () => ({
  useMergedObligationContacts: () => [{ id: "c1", name: "Ali Raza" }],
  useMergedObligationUsers: () => [{ id: "u1", name: "Cashier" }],
}));

const mockCollection: ObligationCollection = {
  id: "col-1",
  receipt_no: "REC-2026-999",
  received_date: "2026-09-13",
  sender_id: "c1",
  amount: 5000,
  currency_id: "USD",
  payment_mode: "Cash",
  obligation_type_id: "ot-1",
  mujtahid_representative_id: "rep-1",
  received_by: "u1",
  created_at: "2026-09-13T00:00:00Z",
  updated_at: "2026-09-13T00:00:00Z",
};

describe("PrintInvoiceModal", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    return () => {
      if (container) {
        container.remove();
        container = null;
      }
    };
  });

  it("renders modal header, subtitle, and action buttons", async () => {
    const onOpenEditor = vi.fn();
    const onClose = vi.fn();
    const root = createRoot(container!);

    await act(async () => {
      root.render(
        <PrintInvoiceModal
          collection={mockCollection}
          onClose={onClose}
          onOpenEditor={onOpenEditor}
        />,
      );
    });

    expect(document.body.textContent).toContain("obligations.print.title");
    expect(document.body.textContent).toContain("REC-2026-999");
    expect(document.body.textContent).toContain("obligations.print.customizeTemplate");

    // Click customize template
    const customizeBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("obligations.print.customizeTemplate"),
    );
    expect(customizeBtn).toBeDefined();

    await act(async () => {
      customizeBtn?.click();
    });

    expect(onOpenEditor).toHaveBeenCalledTimes(1);
  });

  it("handles print execution by opening print window", async () => {
    const mockDocument = {
      write: vi.fn(),
      close: vi.fn(),
      fonts: { ready: Promise.resolve() },
    };
    const mockWindow = {
      document: mockDocument,
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(mockWindow as unknown as Window);

    const root = createRoot(container!);

    await act(async () => {
      root.render(<PrintInvoiceModal collection={mockCollection} onClose={vi.fn()} />);
    });

    const printBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("reports.export.print"),
    );
    expect(printBtn).toBeDefined();

    await act(async () => {
      printBtn?.click();
    });

    expect(window.open).toHaveBeenCalledWith("", "_blank", "width=800,height=700");
    expect(mockDocument.write).toHaveBeenCalled();
    expect(mockDocument.close).toHaveBeenCalled();
  });

  it("notifies error when print popup is blocked", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    const root = createRoot(container!);

    await act(async () => {
      root.render(<PrintInvoiceModal collection={mockCollection} onClose={vi.fn()} />);
    });

    const printBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("reports.export.print"),
    );
    expect(printBtn).toBeDefined();

    await act(async () => {
      printBtn?.click();
    });

    expect(notify.error).toHaveBeenCalledWith("templateEditor.exportFailed");
  });

  it("triggers printing when Cmd+P keyboard shortcut is pressed", async () => {
    const mockDocument = {
      write: vi.fn(),
      close: vi.fn(),
      fonts: { ready: Promise.resolve() },
    };
    const mockWindow = {
      document: mockDocument,
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(mockWindow as unknown as Window);

    const root = createRoot(container!);

    await act(async () => {
      root.render(<PrintInvoiceModal collection={mockCollection} onClose={vi.fn()} />);
    });

    await act(async () => {
      const event = new KeyboardEvent("keydown", {
        key: "p",
        metaKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(window.open).toHaveBeenCalledWith("", "_blank", "width=800,height=700");
    expect(mockDocument.write).toHaveBeenCalled();
  });

  it("renders an accessible scrollable preview region with correct aria attributes", async () => {
    const root = createRoot(container!);

    await act(async () => {
      root.render(<PrintInvoiceModal collection={mockCollection} onClose={vi.fn()} />);
    });

    const region = document.body.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-label")).toBe("obligations.print.preview");
    expect(region?.getAttribute("tabindex")).toBe("0");
  });
});
