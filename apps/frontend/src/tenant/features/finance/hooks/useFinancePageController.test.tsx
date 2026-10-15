import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useFinancePageController } from "./useFinancePageController";

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canWrite: true,
    canDelete: true,
    canReports: true,
    canViewSetup: true,
  }),
}));

vi.mock("@/tenant/hooks/useModuleTierTabs", () => ({
  useFilteredModuleTierTabs: () => [],
}));

vi.mock("@/hooks/usePersistedTabState", () => ({
  usePersistedTabState: (_key: string, initial: string) => React.useState(initial),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/hooks/useDirectoryTrashState", () => ({
  useDirectoryTrashState: () => React.useState(false),
}));

vi.mock("@/tenant/features/finance/hooks/useFinanceApi", () => ({
  useFinanceInvoicesPaginated: () => ({ data: { invoices: [] } }),
  useFinancePaymentsPaginated: () => ({ data: { payments: [] } }),
  useFinanceMutations: () => ({
    createInvoice: { mutateAsync: vi.fn() },
    createPayment: { mutateAsync: vi.fn() },
    deleteInvoice: { mutateAsync: vi.fn() },
    restoreInvoice: { mutateAsync: vi.fn() },
    bulkDeleteInvoices: { mutateAsync: vi.fn() },
    bulkRestoreInvoices: { mutateAsync: vi.fn() },
    bulkUpdateInvoiceStatus: { mutateAsync: vi.fn() },
    deletePayment: { mutateAsync: vi.fn() },
    restorePayment: { mutateAsync: vi.fn() },
    bulkDeletePayments: { mutateAsync: vi.fn() },
    bulkRestorePayments: { mutateAsync: vi.fn() },
  }),
}));

vi.mock("@/tenant/features/finance/hooks/useFinanceInvoiceColumnLayout", () => ({
  useFinanceInvoiceColumnLayout: () => ({}),
}));

vi.mock("@/tenant/features/finance/hooks/useFinancePaymentColumnLayout", () => ({
  useFinancePaymentColumnLayout: () => ({}),
}));

vi.mock("@/hooks/useMessageComposerState", () => ({
  useMessageComposerState: () => ({
    canWriteMessaging: true,
    messagingTarget: null,
    openComposer: vi.fn(),
    closeComposer: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/finance/hooks/useFinanceCollect", () => ({
  useFinanceCollectMutations: () => ({
    collect: { isPending: false, mutateAsync: vi.fn() },
    remind: { isPending: false, mutateAsync: vi.fn() },
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function renderFinanceControllerHook() {
  const result: { current: ReturnType<typeof useFinancePageController> } = {} as {
    current: ReturnType<typeof useFinancePageController>;
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function HookHost() {
    result.current = useFinancePageController();
    return null;
  }

  act(() => {
    root.render(<HookHost />);
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useFinancePageController selection", () => {
  it("owns invoice selection and clears it on sub-tab switch", () => {
    const { result, unmount } = renderFinanceControllerHook();
    try {
      act(() => result.current.invoiceSelection.toggleSelected("INV-1", true));
      expect(result.current.invoiceSelection.selectedIds).toEqual(["INV-1"]);
      act(() => result.current.setActiveSubTab("payments"));
      expect(result.current.invoiceSelection.selectedIds).toEqual([]);
    } finally {
      unmount();
    }
  });

  it("clears both selections on trash toggle", () => {
    const { result, unmount } = renderFinanceControllerHook();
    try {
      act(() => {
        result.current.invoiceSelection.toggleSelected("INV-1", true);
        result.current.paymentSelection.toggleSelected("PAY-1", true);
      });
      act(() => result.current.setShowDeleted(true));
      expect(result.current.invoiceSelection.selectedIds).toEqual([]);
      expect(result.current.paymentSelection.selectedIds).toEqual([]);
    } finally {
      unmount();
    }
  });

  it("exposes a real selectedCount to module shortcuts (no stub)", () => {
    const { result, unmount } = renderFinanceControllerHook();
    try {
      expect(result.current.invoiceSelection.selectedIds).toEqual([]);
      act(() => result.current.paymentSelection.toggleSelectAll(true, ["PAY-1", "PAY-2"]));
      expect(result.current.paymentSelection.selectedIds).toHaveLength(2);
    } finally {
      unmount();
    }
  });
});
