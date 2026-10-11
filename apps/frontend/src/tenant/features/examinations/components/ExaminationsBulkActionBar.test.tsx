import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationsBulkActionBar } from "./ExaminationsBulkActionBar";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count) return `${params.count} selected`;
      return key;
    },
  }),
}));

vi.mock("@/components/ui/ModuleWorkBulkActionBar", () => ({
  ModuleWorkBulkActionBar: ({ countLabel }: any) => <div data-testid="bulk-bar">{countLabel}</div>,
}));

describe("ExaminationsBulkActionBar Component", () => {
  it("renders bulk actions bar with count label", () => {
    const html = renderToStaticMarkup(
      <ExaminationsBulkActionBar
        selectedCount={3}
        showDeleted={false}
        canDelete={true}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );

    expect(html).toContain("3 selected");
  });
});
