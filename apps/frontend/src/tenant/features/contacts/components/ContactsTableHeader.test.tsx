import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsTableHeader } from "./ContactsTableHeader";

vi.mock("@/components/app/ModuleWorkTableHeader", () => ({
  ModuleWorkTableHeader: ({
    columns,
    actionsLabel,
  }: {
    columns: Array<{ id: string; label: string }>;
    actionsLabel: string;
  }) => (
    <thead data-testid="work-table-header">
      <tr>
        {columns.map((col) => (
          <th key={col.id}>{col.label}</th>
        ))}
        <th>{actionsLabel}</th>
      </tr>
    </thead>
  ),
}));

describe("ContactsTableHeader Component", () => {
  it("renders table header with column labels and actions header", () => {
    const html = renderToStaticMarkup(
      <ContactsTableHeader
        columns={[
          { id: "name", label: "Contact Name" },
          { id: "phone", label: "Phone Number" },
        ]}
        sortField="name"
        sortDir="asc"
        onSort={vi.fn()}
        getColumnWidth={() => 120}
        setColumnWidth={vi.fn()}
        allSelected={false}
        someSelected={false}
        onSelectAll={vi.fn()}
        t={((key: string) => key) as never}
      />,
    );

    expect(html).toContain("Contact Name");
    expect(html).toContain("Phone Number");
    expect(html).toContain("contacts.table.actions");
  });
});
