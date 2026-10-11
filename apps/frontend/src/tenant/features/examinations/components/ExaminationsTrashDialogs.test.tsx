import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExaminationsTrashDialogs } from "./ExaminationsTrashDialogs";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ExaminationsTrashDialogs", () => {
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
    vi.clearAllMocks();
  });

  it("renders row trash confirm dialog when pendingTrashId is set and triggers onConfirmRowTrash", async () => {
    const onConfirmRowTrash = vi.fn();
    const onPendingTrashIdChange = vi.fn();

    await act(async () => {
      root.render(
        <ExaminationsTrashDialogs
          pendingTrashId="exam-123"
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

    expect(document.body.textContent).toContain("examinations.trash.deleteTitle");
    expect(document.body.textContent).toContain("examinations.trash.deleteConfirm");

    const deleteBtn = Array.from(document.body.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("common.delete"),
    );
    expect(deleteBtn).toBeDefined();

    await act(async () => {
      deleteBtn?.click();
    });

    expect(onConfirmRowTrash).toHaveBeenCalled();
  });

  it("renders bulk delete dialog when confirmBulkOpen is true and triggers onConfirmBulkTrash", async () => {
    const onConfirmBulkTrash = vi.fn();
    const onConfirmBulkOpenChange = vi.fn();

    await act(async () => {
      root.render(
        <ExaminationsTrashDialogs
          pendingTrashId={null}
          onPendingTrashIdChange={vi.fn()}
          confirmBulkOpen={true}
          onConfirmBulkOpenChange={onConfirmBulkOpenChange}
          showDeleted={false}
          selectedCount={5}
          onConfirmRowTrash={vi.fn()}
          onConfirmBulkTrash={onConfirmBulkTrash}
        />,
      );
    });

    expect(document.body.textContent).toContain("examinations.trash.deleteTitle");

    const confirmBtn = Array.from(document.body.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("common.delete"),
    );
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn?.click();
    });

    expect(onConfirmBulkTrash).toHaveBeenCalled();
  });

  it("renders bulk restore dialog when showDeleted is true", async () => {
    const onConfirmBulkTrash = vi.fn();

    await act(async () => {
      root.render(
        <ExaminationsTrashDialogs
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

    expect(document.body.textContent).toContain("examinations.trash.restore");

    const restoreBtn = Array.from(document.body.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("examinations.trash.restore"),
    );
    expect(restoreBtn).toBeDefined();

    await act(async () => {
      restoreBtn?.click();
    });

    expect(onConfirmBulkTrash).toHaveBeenCalled();
  });
});
