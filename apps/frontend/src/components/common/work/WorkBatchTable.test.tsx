import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkBatchTable } from "./WorkBatchTable";
import { TranslationContext, type TranslationFunction } from "@/lib/contexts/TranslationContext";

const mockContext = {
  language: "en",
  t: ((key: string) => key) as TranslationFunction,
  isLoading: false,
  dir: "ltr" as const,
  isRtl: false,
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <TranslationContext.Provider value={mockContext}>{children}</TranslationContext.Provider>;
}

describe("WorkBatchTable", () => {
  interface SampleRow {
    id: string;
    name: string;
    status: string;
  }

  const sampleData: SampleRow[] = [
    { id: "1", name: "Ahmed", status: "Active" },
    { id: "2", name: "Fatima", status: "Pending" },
  ];

  const columns = [
    {
      id: "name",
      label: "Name",
      render: (row: SampleRow) => <span>{row.name}</span>,
    },
    {
      id: "status",
      label: "Status",
      render: (row: SampleRow) => <span>{row.status}</span>,
    },
  ];

  it("renders data rows and column headers", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkBatchTable data={sampleData} columns={columns} />
      </TestWrapper>,
    );

    expect(html).toContain("Name");
    expect(html).toContain("Status");
    expect(html).toContain("Ahmed");
    expect(html).toContain("Fatima");
  });

  it("renders selection column and footer count", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkBatchTable
          data={sampleData}
          columns={columns}
          selection={{
            selectedIds: ["1"],
            onSelectOne: vi.fn(),
            onSelectAll: vi.fn(),
            allSelected: false,
            someSelected: true,
            selectAllAriaLabel: "Select all rows",
          }}
          footerCount={{
            pageCountLabel: "Showing 2 of 2 records",
            selectedCountLabel: "1 selected",
          }}
        />
      </TestWrapper>,
    );

    expect(html).toContain("Select all rows");
    expect(html).toContain("Showing 2 of 2 records");
    expect(html).toContain("1 selected");
  });

  it("renders empty state when data is empty", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkBatchTable
          data={[]}
          columns={columns}
          emptyState={<div id="empty">No records found</div>}
        />
      </TestWrapper>,
    );

    expect(html).toContain("No records found");
  });

  it("applies custom rowClassName when provided", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkBatchTable
          data={sampleData}
          columns={columns}
          rowClassName={(row) => (row.status === "Pending" ? "bg-warning/10" : undefined)}
        />
      </TestWrapper>,
    );

    expect(html).toContain("bg-warning/10");
  });

  it("handles datasets larger than 30 rows with virtualization container styling", () => {
    const largeDataset: SampleRow[] = Array.from({ length: 40 }, (_, i) => ({
      id: String(i + 1),
      name: `Person ${i + 1}`,
      status: "Active",
    }));

    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkBatchTable data={largeDataset} columns={columns} />
      </TestWrapper>,
    );

    // Container should include max-h-150 and overflow-y-auto when virtualized
    expect(html).toContain("max-h-150");
    expect(html).toContain("overflow-y-auto");
  });

  it("renders structured footerRow with alignment and colSpan", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkBatchTable
          data={sampleData}
          columns={columns}
          footerRow={{
            cells: [
              { colSpan: 1, content: "Total Records: 2", align: "start" },
              { colSpan: 1, content: "100%", align: "end" },
            ],
          }}
        />
      </TestWrapper>,
    );

    expect(html).toContain("Total Records: 2");
    expect(html).toContain("100%");
    expect(html).toContain("text-end");
  });

  it("renders a custom tableFooter OUTSIDE the <table> element (valid DOM nesting)", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkBatchTable
          data={sampleData}
          columns={columns}
          tableFooter={<div id="fleet-footer-bar">footer bar</div>}
        />
      </TestWrapper>,
    );

    // Regression: a non-<tr> child inside <table> is invalid HTML and triggers React's
    // "In HTML, <div> cannot be a child of <table>" warning.
    const tableMarkup = /<table[\s\S]*?<\/table>/.exec(html)?.[0] ?? "";
    expect(tableMarkup).not.toContain("fleet-footer-bar");
    expect(html).toContain("fleet-footer-bar");
  });

  it("keeps the structured footerRow INSIDE the <table> element", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkBatchTable
          data={sampleData}
          columns={columns}
          footerRow={{ cells: [{ content: "TOTAL-IN-TABLE" }] }}
        />
      </TestWrapper>,
    );

    const tableMarkup = /<table[\s\S]*?<\/table>/.exec(html)?.[0] ?? "";
    expect(tableMarkup).toContain("TOTAL-IN-TABLE");
  });
});
