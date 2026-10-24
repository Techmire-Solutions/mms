import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BulkActionDock,
  BulkSelectionDeleteAction,
  BulkSelectionRestoreAction,
} from "@/components/common/BulkActionDock";

vi.mock("@/hooks/useTranslation", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});

describe("BulkActionDock", () => {
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

  it("does not render when selectedCount is 0", () => {
    const html = renderToStaticMarkup(
      <BulkActionDock selectedCount={0} onClearSelection={() => {}}>
        <span>Hidden</span>
      </BulkActionDock>,
    );

    expect(html).toBe("");
  });
});
