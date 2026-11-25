import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression: `saving` state only disables the footer button after a re-render,
 * so a same-tick double submit (footer click + Enter) posted the fee entry twice
 * and generated two invoices/ledger entries. `useSubmitGuard` must collapse both
 * synchronous invocations into exactly one `mutateAsync`.
 */

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingApi", () => ({
  useProcessSpecializedEntryMutation: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));

vi.mock("@mms/fe-core/notify", () => ({
  notify: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/tenant/components/selectors/RegistryPersonSelect", () => ({
  RegistryPersonSelect: ({ onChange }: { onChange: (id: string, name?: string) => void }) => (
    <button type="button" data-testid="pick-student" onClick={() => onChange("std-1", "Ali Raza")}>
      pick student
    </button>
  ),
}));

vi.mock("@mms/fe-core/components/FormModal", () => ({
  FormModal: ({
    children,
    onSave,
    error,
  }: {
    children: React.ReactNode;
    onSave?: () => Promise<void> | void;
    error?: string;
  }) => (
    <div>
      {children}
      {error ? <p data-testid="save-error">{error}</p> : null}
      <button
        type="button"
        data-testid="form-modal-save"
        onClick={() => {
          void onSave?.();
        }}
      >
        save
      </button>
    </div>
  ),
}));

import { SpecializedEntryModal } from "./SpecializedEntryModal";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SpecializedEntryModal fee double submit", () => {
  let container: HTMLDivElement;
  let root: Root;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function renderWithClient(node: React.ReactNode) {
    root.render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  }

  beforeEach(() => {
    mocks.mutateAsync.mockReset();
    mocks.mutateAsync.mockResolvedValue({ ledgerPosted: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("collapses two synchronous save invocations into one mutateAsync", async () => {
    await act(async () => {
      renderWithClient(<SpecializedEntryModal type="fee" accounts={[]} onClose={vi.fn()} />);
    });

    const studentPicker = container.querySelector<HTMLButtonElement>(
      '[data-testid="pick-student"]',
    );
    await act(async () => {
      studentPicker?.click();
    });
    const amount = container.querySelector<HTMLInputElement>('input[name="amount"]');
    expect(amount).not.toBeNull();
    await act(async () => {
      setInputValue(amount as HTMLInputElement, "100");
    });

    const save = container.querySelector<HTMLButtonElement>('[data-testid="form-modal-save"]');
    expect(save).not.toBeNull();

    // Two invocations before React can re-render and disable anything.
    await act(async () => {
      save?.click();
      save?.click();
    });

    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
  });
});
