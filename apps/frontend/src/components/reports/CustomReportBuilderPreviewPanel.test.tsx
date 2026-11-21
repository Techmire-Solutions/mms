import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exportMocks = vi.hoisted(() => ({
  exportReportExcel: vi.fn(),
  exportReportPdf: vi.fn(),
}));

vi.mock("@/lib/reports/reportExportCore", () => exportMocks);
vi.mock("./CustomReportBuilderPreviewVisualizer", () => ({
  CustomReportBuilderPreviewVisualizer: () => null,
}));

import { CustomReportBuilderPreviewPanel } from "./CustomReportBuilderPreviewPanel";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LABELS: Record<string, string> = { fullName: "Full Name", grade: "Grade" };
const resolveFieldLabel = (field: string): string => LABELS[field] ?? field;

describe("CustomReportBuilderPreviewPanel exports", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderPanel(): Promise<void> {
    await act(async () => {
      root.render(
        <CustomReportBuilderPreviewPanel
          selectedFields={["fullName", "grade"]}
          setSelectedFields={vi.fn()}
          previewData={[{ "Full Name": "Ali Raza", Grade: "Grade 1" }]}
          aggregate="None"
          groupBy=""
          reportName="Roster"
          orientation="l"
          pageSize="a4"
          removeField={vi.fn()}
          moveUp={vi.fn()}
          moveDown={vi.fn()}
          resolveFieldLabel={resolveFieldLabel}
        />,
      );
    });
  }

  function clickButton(label: string): void {
    const button = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(label),
    );
    expect(button).toBeInstanceOf(HTMLButtonElement);
    button?.click();
  }

  const expectedColumns = [
    { header: "Full Name", key: "Full Name" },
    { header: "Grade", key: "Grade" },
  ];

  it("given label-keyed preview rows, should export the Document with label-keyed columns", async () => {
    await renderPanel();

    await act(async () => clickButton("reports.builder.document"));

    expect(exportMocks.exportReportPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Roster",
        columns: expectedColumns,
        rows: [{ "Full Name": "Ali Raza", Grade: "Grade 1" }],
        orientation: "l",
        formatSize: "a4",
      }),
    );
  });

  it("given the same rows, should export the Sheet with the same columns as the Document", async () => {
    await renderPanel();

    await act(async () => clickButton("reports.builder.sheet"));

    expect(exportMocks.exportReportExcel).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Roster", columns: expectedColumns }),
    );
  });
});
