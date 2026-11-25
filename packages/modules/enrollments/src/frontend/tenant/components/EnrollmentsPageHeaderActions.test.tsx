import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsPageHeaderActions } from "./EnrollmentsPageHeaderActions";

describe("EnrollmentsPageHeaderActions Component", () => {
  it("renders export and new buttons when permissions are granted", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsPageHeaderActions
        canExport={true}
        canWriteEnrollments={true}
        showDeleted={false}
        t={((k: string) => k) as unknown as never}
        onExport={vi.fn()}
        onNew={vi.fn()}
      />,
    );

    expect(html).toContain("common.export");
    expect(html).toContain("enrollments.new");
  });

  it("renders import button when onImport is provided and canWriteEnrollments is true", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsPageHeaderActions
        canExport={true}
        canWriteEnrollments={true}
        showDeleted={false}
        t={((k: string) => k) as unknown as never}
        onExport={vi.fn()}
        onNew={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(html).toContain("common.import");
  });

  it("hides buttons when in trash/deleted view", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsPageHeaderActions
        canExport={true}
        canWriteEnrollments={true}
        showDeleted={true}
        t={((k: string) => k) as unknown as never}
        onExport={vi.fn()}
        onNew={vi.fn()}
      />,
    );

    expect(html).not.toContain("common.export");
    expect(html).not.toContain("enrollments.new");
  });
});
