import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleWorkBulkActionBar } from "./ModuleWorkBulkActionBar";

describe("ModuleWorkBulkActionBar", () => {
  it("renders selection count, clear button, and extra actions", () => {
    const html = renderToStaticMarkup(
      <ModuleWorkBulkActionBar
        selectedCount={3}
        countLabel="3 selected"
        leading={<span data-testid="leading-slot">Test Lead</span>}
        deselectLabel="Clear all"
        canDelete={true}
        restoreLabel="Restore"
        onRequestBulkRestore={() => {}}
        onClearSelection={() => {}}
        deleteAction={{
          label: "Delete selected",
          onClick: () => {},
        }}
      />,
    );

    expect(html).toContain("3 selected");
    expect(html).toContain("Test Lead");
    expect(html).toContain("Clear all");
    expect(html).toContain("Delete selected");
  });

  it("renders restore action when viewing deleted items", () => {
    const html = renderToStaticMarkup(
      <ModuleWorkBulkActionBar
        selectedCount={1}
        viewingDeleted={true}
        countLabel="1 selected"
        leading={null}
        deselectLabel="Clear"
        canDelete={true}
        restoreLabel="Restore selected"
        onRequestBulkRestore={() => {}}
        onClearSelection={() => {}}
      />,
    );

    expect(html).toContain("Restore selected");
  });
});
