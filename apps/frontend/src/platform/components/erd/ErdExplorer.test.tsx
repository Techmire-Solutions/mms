import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErdExplorer } from "./ErdExplorer";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "nav.accounting": "Accounting",
        "nav.attendance": "Attendance",
        "platform.erdDomainLabel": "Schema domain",
        "platform.erdFocusTable": "Related tables",
        "platform.erdAllTables": "All related tables",
        "platform.erdTableCount": "tables",
        "platform.erdRelationships": "Relationships",
        "platform.erdDiagram": "Entity-relationship diagram",
        "common.loading": "Loading…",
      };
      return map[key] ?? key;
    },
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return renderToStaticMarkup(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("ErdExplorer", () => {
  it("renders the accounting ERD by default", () => {
    const html = renderWithClient(
      <MemoryRouter initialEntries={["/platform/erd"]}>
        <ErdExplorer />
      </MemoryRouter>,
    );
    expect(html).toContain("accounting_accounts");
    expect(html).toContain("accounting_journal_lines");
    expect(html).toContain("Schema domain");
    expect(html).toContain("Related tables");
  });

  it("filters to a table and its neighbors from the query string", () => {
    const html = renderWithClient(
      <MemoryRouter initialEntries={["/platform/erd?domain=attendance&table=attendance"]}>
        <ErdExplorer />
      </MemoryRouter>,
    );
    expect(html).toContain("attendance.student_id");
    expect(html).toContain("students.id");
    expect(html).not.toContain("accounting_accounts");
  });
});
