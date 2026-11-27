import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JournalEntryLinesEditor } from "./JournalEntryLinesEditor";

vi.mock("@mms/fe-core/query/optionalQueryContext", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuthOrNull: () => ({ isAuthenticated: true, user: { id: "u-1" }, token: "test-token" }),
}));

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@mms/fe-core/tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/fe-core/tenant")>();
  return {
    ...actual,

    useWorkDirectoryViewMode: () => ({ viewMode: "table" }),
  };
});

vi.mock("framer-motion", () => {
  const comp = ({ children, ...props }: { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  );
  return {
    m: new Proxy(
      {},
      {
        get: (_target, key) =>
          key === "create" ? (Component: React.ElementType) => Component : comp,
      },
    ),
    motion: {
      div: comp,
    },
  };
});

describe("JournalEntryLinesEditor", () => {
  it("uses FormCollectionShell add-another chrome", () => {
    const html = renderToStaticMarkup(
      <JournalEntryLinesEditor
        accounts={[]}
        accountOptions={[]}
        errors={{}}
        lines={[
          { id: "l1", account_id: "", description: "", debit: "", credit: "" },
          { id: "l2", account_id: "", description: "", debit: "", credit: "" },
        ]}
        totalDebit={0}
        totalCredit={0}
        isBalanced
        formatCurrency={(n) => String(n)}
        onAddLine={vi.fn()}
        onRemoveLine={vi.fn()}
        onUpdateLine={vi.fn()}
        viewMode="table"
      />,
    );

    expect(html).toContain("accounting.journal.form.addLine");
    expect(html).toContain("accounting.journal.form.linesTitle");
    expect(html).toContain("border-dashed");
  });
});
