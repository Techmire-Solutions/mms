import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BulkActionDock,
  BulkSelectionDeleteAction,
  BulkSelectionRestoreAction,
} from "@/components/common/BulkActionDock";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const overlay = vi.hoisted(() => ({
  overlayLayerCount: vi.fn(() => 0),
  isAnotherLayerFocused: vi.fn(() => false),
}));

vi.mock("@/lib/overlayStack", () => ({
  overlayLayerCount: overlay.overlayLayerCount,
  isAnotherLayerFocused: overlay.isAnotherLayerFocused,
}));

vi.mock("@/hooks/useTranslation", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});

describe("BulkActionDock", () => {
  beforeEach(() => {
    overlay.overlayLayerCount.mockReturnValue(0);
    overlay.isAnotherLayerFocused.mockReturnValue(false);
  });

  it("renders bulk selection count and actions", () => {
    const html = renderToStaticMarkup(
      <BulkActionDock
        selectedCount={5}
        countLabel="5 students selected"
        onClearSelection={() => {}}
        clearLabel="Deselect all"
      >
        <BulkSelectionDeleteAction label="Delete selected" onClick={() => {}} />
        <BulkSelectionRestoreAction label="Restore selected" onClick={() => {}} />
      </BulkActionDock>,
    );

    expect(html).toContain("5 students selected");
    expect(html).toContain("Deselect all");
    expect(html).toContain("Delete selected");
    expect(html).toContain("Restore selected");
  });

  it("formats generic countLabel when totalCount is provided without custom label", () => {
    const html = renderToStaticMarkup(
      <BulkActionDock selectedCount={3} totalCount={20} onClearSelection={() => {}} />,
    );

    expect(html).toContain("3 / 20 selected");
  });

  it("exposes compound components for actions and separators", () => {
    expect(BulkActionDock.Action).toBeDefined();
    expect(BulkActionDock.Separator).toBeDefined();
    expect(BulkActionDock.Clear).toBeDefined();
    expect(BulkActionDock.Delete).toBeDefined();
    expect(BulkActionDock.Restore).toBeDefined();
    expect(BulkActionDock.Export).toBeDefined();
    expect(BulkActionDock.Messaging).toBeDefined();
    expect(BulkActionDock.Status).toBeDefined();
  });

  it("renders compound actions cleanly inside the dock", () => {
    const html = renderToStaticMarkup(
      <BulkActionDock selectedCount={2} onClearSelection={() => {}} placement="floating">
        <BulkActionDock.Action onClick={() => {}}>Custom Action</BulkActionDock.Action>
        <BulkActionDock.Separator />
        <BulkActionDock.Delete label="Remove" onClick={() => {}} />
      </BulkActionDock>,
    );

    expect(html).toContain("Custom Action");
    expect(html).toContain("Remove");
  });

  it("exposes the action cluster as a labelled toolbar with a 44px select-all target", () => {
    const html = renderToStaticMarkup(
      <BulkActionDock selectedCount={2} onClearSelection={() => {}} onSelectAllToggle={() => {}}>
        <BulkSelectionDeleteAction label="Delete selected" onClick={() => {}} />
      </BulkActionDock>,
    );
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-label="Actions"');
    expect(html).toContain("after:min-w-11");
    expect(html).toContain("after:h-11");
  });

  it("does not clear the selection on Escape while an overlay owns the keyboard", async () => {
    const onClearSelection = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(
        <BulkActionDock selectedCount={2} onClearSelection={onClearSelection}>
          <BulkSelectionDeleteAction label="Delete selected" onClick={() => {}} />
        </BulkActionDock>,
      );
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClearSelection).toHaveBeenCalledTimes(1);
    overlay.overlayLayerCount.mockReturnValue(1);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClearSelection).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    container.remove();
  });

  it("does not render when selectedCount is 0", () => {
    const html = renderToStaticMarkup(
      <BulkActionDock selectedCount={0} onClearSelection={() => {}}>
        <span>Hidden</span>
      </BulkActionDock>,
    );

    expect(html).toBe("");
  });
});
