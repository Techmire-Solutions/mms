import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionBankTrashDialogs } from "./QuestionBankTrashDialogs";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.count !== undefined) {
        return `${key}:${params.count}`;
      }
      return key;
    },
  }),
}));

describe("QuestionBankTrashDialogs", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.querySelectorAll("[role='alertdialog']").forEach((el) => el.remove());
    vi.clearAllMocks();
  });

  it("renders row trash confirm dialog and calls onConfirmRowTrash", async () => {
    const onConfirmRowTrash = vi.fn();
    const onPendingTrashIdChange = vi.fn();

    await act(async () => {
      root.render(
        <QuestionBankTrashDialogs
          pendingTrashId="q-123"
          onPendingTrashIdChange={onPendingTrashIdChange}
          confirmBulkOpen={false}
          onConfirmBulkOpenChange={vi.fn()}
          showDeleted={false}
          selectedCount={0}
          onConfirmRowTrash={onConfirmRowTrash}
          onConfirmBulkTrash={vi.fn()}
        />,
      );
    });

    expect(document.body.textContent).toContain("questionBank.trash.deleteTitle");
    expect(document.body.textContent).toContain("questionBank.trash.deleteConfirm");

    const deleteBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("common.delete"),
    );
    expect(deleteBtn).toBeDefined();

    await act(async () => {
      deleteBtn?.click();
    });

    expect(onConfirmRowTrash).toHaveBeenCalled();
  });

  it("renders bulk delete confirm dialog and calls onConfirmBulkTrash", async () => {
    const onConfirmBulkTrash = vi.fn();

    await act(async () => {
      root.render(
        <QuestionBankTrashDialogs
          pendingTrashId={null}
          onPendingTrashIdChange={vi.fn()}
          confirmBulkOpen={true}
          onConfirmBulkOpenChange={vi.fn()}
          showDeleted={false}
          selectedCount={4}
          onConfirmRowTrash={vi.fn()}
          onConfirmBulkTrash={onConfirmBulkTrash}
        />,
      );
    });

    expect(document.body.textContent).toContain("questionBank.trash.bulkDeleteConfirm:4");

    const deleteBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("common.delete"),
    );
    expect(deleteBtn).toBeDefined();

    await act(async () => {
      deleteBtn?.click();
    });

    expect(onConfirmBulkTrash).toHaveBeenCalled();
  });

  it("renders bulk restore confirm dialog when showDeleted is true", async () => {
    const onConfirmBulkTrash = vi.fn();

    await act(async () => {
      root.render(
        <QuestionBankTrashDialogs
          pendingTrashId={null}
          onPendingTrashIdChange={vi.fn()}
          confirmBulkOpen={true}
          onConfirmBulkOpenChange={vi.fn()}
          showDeleted={true}
          selectedCount={3}
          onConfirmRowTrash={vi.fn()}
          onConfirmBulkTrash={onConfirmBulkTrash}
        />,
      );
    });

    expect(document.body.textContent).toContain("questionBank.trash.bulkRestoreConfirm:3");
    expect(document.body.textContent).toContain("questionBank.trash.restore");

    const restoreBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("questionBank.trash.restore"),
    );
    expect(restoreBtn).toBeDefined();

    await act(async () => {
      restoreBtn?.click();
    });

    expect(onConfirmBulkTrash).toHaveBeenCalled();
  });
});
