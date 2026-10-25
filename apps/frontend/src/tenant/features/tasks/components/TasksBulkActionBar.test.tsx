import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TasksBulkActionBar } from "./TasksBulkActionBar";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string, p?: { count?: number }) => (p?.count !== undefined ? `${k}:${p.count}` : k),
  }),
}));

describe("TasksBulkActionBar", () => {
  it("renders null when selectedCount is 0", () => {
    const html = renderToStaticMarkup(
      <TasksBulkActionBar
        selectedCount={0}
        viewingDeleted={false}
        canDelete={true}
        onClearSelection={vi.fn()}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
      />,
    );
    expect(html).toBe("");
  });

  it("renders selection count and archive action when items selected in active view", () => {
    const html = renderToStaticMarkup(
      <TasksBulkActionBar
        selectedCount={3}
        viewingDeleted={false}
        canDelete={true}
        onClearSelection={vi.fn()}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
      />,
    );

    expect(html).toContain("tasks.selectedCount:3");
    expect(html).toContain("common.delete");
    expect(html).toContain("common.deselect");
  });

  it("renders restore action when items selected in trash view", () => {
    const html = renderToStaticMarkup(
      <TasksBulkActionBar
        selectedCount={2}
        viewingDeleted={true}
        canDelete={true}
        onClearSelection={vi.fn()}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
      />,
    );

    expect(html).toContain("tasks.selectedCount:2");
    expect(html).toContain("tasks.trash.restore");
    expect(html).toContain("common.deselect");
  });
});
