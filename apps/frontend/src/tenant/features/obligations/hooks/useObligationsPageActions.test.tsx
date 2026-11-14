import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";

/**
 * The create path used to send the entire cached directory to `PUT /collections/bulk`. The route
 * upserts and bumps `version` for every row in the payload, so one create made every other receipt
 * stale for other sessions — and the contract's `replace…` name meant a true-replace handler would
 * have deleted anything the truncated payload omitted (frontend write-path audit F1).
 */

const mocks = vi.hoisted(() => ({
  notifyError: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: { error: mocks.notifyError, success: vi.fn() },
}));

import { useObligationsPageActions } from "./useObligationsPageActions";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Actions = ReturnType<typeof useObligationsPageActions>;

function renderActions(params: unknown): { result: Actions } {
  let result!: Actions;
  function TestComponent() {
    result = useObligationsPageActions(params as never);
    return null;
  }
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => {
    root.render(<TestComponent />);
  });
  return { result };
}

const t = ((key: string) => key) as never;

type Params = {
  replaceCollections: { mutateAsync: ReturnType<typeof vi.fn> };
  setShowForm: ReturnType<typeof vi.fn>;
  refetchCollections: ReturnType<typeof vi.fn>;
} & Record<string, unknown>;

function makeParams(overrides: Record<string, unknown> = {}): Params {
  return {
    t,
    replaceCollections: { mutateAsync: vi.fn().mockResolvedValue({}) },
    deleteCollection: { mutateAsync: vi.fn() },
    restoreCollection: { mutateAsync: vi.fn() },
    bulkDeleteCollections: { mutateAsync: vi.fn() },
    bulkRestoreCollections: { mutateAsync: vi.fn() },
    clearCollectionSelection: vi.fn(),
    setShowForm: vi.fn(),
    openComposer: vi.fn(),
    canWriteMessaging: true,
    refetchCollections: vi.fn(),
    ...overrides,
  } as unknown as Params;
}

const newReceipt = { id: "oc-new", receipt_no: "REC-NEW", amount: 99 } as never;

describe("handleSaveCollection", () => {
  it("sends exactly one record, not the cached directory", async () => {
    const params = makeParams();
    const { result } = renderActions(params);

    await act(async () => {
      await result.handleSaveCollection(newReceipt);
    });

    const replace = params.replaceCollections.mutateAsync;
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toEqual([newReceipt]);
    expect(params.setShowForm).toHaveBeenCalledWith(false);
  });

  it("keeps the modal open when the save fails", async () => {
    const params = makeParams({
      replaceCollections: { mutateAsync: vi.fn().mockRejectedValue(new Error("boom")) },
    });
    const { result } = renderActions(params);

    await act(async () => {
      await expect(result.handleSaveCollection(newReceipt)).rejects.toThrow("boom");
    });

    expect(params.setShowForm).not.toHaveBeenCalled();
    expect(mocks.notifyError).toHaveBeenCalledWith("obligations.saveFailed", expect.anything());
  });

  it("refreshes the list and names the conflict on a 409", async () => {
    const params = makeParams({
      replaceCollections: {
        mutateAsync: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error("stale"), { status: 409, type: "stale_write" }),
          ),
      },
    });
    const { result } = renderActions(params);

    await act(async () => {
      await expect(result.handleSaveCollection(newReceipt)).rejects.toThrow("stale");
    });

    expect(params.refetchCollections).toHaveBeenCalledTimes(1);
    expect(mocks.notifyError).toHaveBeenCalledWith("obligations.saveConflict", expect.anything());
  });

  it("names a duplicate receipt number instead of a stale write", async () => {
    // Receipt numbers are generated client-side from the loaded list, so the unique index rejecting
    // a duplicate is the common 409 — it must not tell the user someone else edited the receipt.
    const params = makeParams({
      replaceCollections: {
        mutateAsync: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error("duplicate"), { status: 409, type: "conflict" }),
          ),
      },
    });
    const { result } = renderActions(params);

    await act(async () => {
      await expect(result.handleSaveCollection(newReceipt)).rejects.toThrow("duplicate");
    });

    expect(mocks.notifyError).toHaveBeenCalledWith(
      "obligations.saveDuplicateReceipt",
      expect.anything(),
    );
    expect(params.refetchCollections).not.toHaveBeenCalled();
  });
});
