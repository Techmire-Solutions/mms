import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UserPlus } from "lucide-react";
import { ModuleEntityIoToolbar } from "./ModuleEntityIoToolbar";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ModuleEntityIoToolbar", () => {
  it("renders export, import, and add when handlers and caps allow", () => {
    const html = renderToStaticMarkup(
      <ModuleEntityIoToolbar
        canExport
        canWrite
        viewingDeleted={false}
        onExport={vi.fn()}
        onImport={vi.fn()}
        onAdd={vi.fn()}
        addLabel="Add Thing"
        addIcon={UserPlus}
        exportLabel="Export"
        importLabel="Import"
      />,
    );

    expect(html).toContain("Export");
    expect(html).toContain("Import");
    expect(html).toContain("Add Thing");
  });

  it("omits import when onImport is missing", () => {
    const html = renderToStaticMarkup(
      <ModuleEntityIoToolbar
        canExport
        canWrite
        onExport={vi.fn()}
        onAdd={vi.fn()}
        addLabel="Add Thing"
      />,
    );

    expect(html).toContain("common.export");
    expect(html).toContain("Add Thing");
    expect(html).not.toContain("common.import");
  });

  it("returns null when viewingDeleted", () => {
    const html = renderToStaticMarkup(
      <ModuleEntityIoToolbar
        canExport
        canWrite
        viewingDeleted
        onExport={vi.fn()}
        onImport={vi.fn()}
        onAdd={vi.fn()}
        addLabel="Add Thing"
      />,
    );
    expect(html).toBe("");
  });

  it("returns null when nothing to show", () => {
    const html = renderToStaticMarkup(
      <ModuleEntityIoToolbar canWrite={false} addLabel="Add Thing" />,
    );
    expect(html).toBe("");
  });
});
