import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsBulkActionBar } from "./ContactsBulkActionBar";

type ExportAction = {
  label: string;
  onClick: () => void | Promise<void>;
  isPending?: boolean;
};

let lastExportAction: ExportAction | undefined;

vi.mock("@/components/app/ModuleUniversalBulkActionBar", () => ({
  ModuleUniversalBulkActionBar: ({
    selectedCount,
    deleteLabel,
    exportAction,
  }: {
    selectedCount: number;
    deleteLabel?: string;
    exportAction?: ExportAction;
  }) => {
    lastExportAction = exportAction;
    return (
      <div data-testid="bulk-action-bar">
        <span>{`contacts.selectedCount:${selectedCount}`}</span>
        {deleteLabel ? <button>{deleteLabel}</button> : null}
        {exportAction ? (
          <button data-exporting={String(Boolean(exportAction.isPending))}>
            {exportAction.label}
          </button>
        ) : null}
      </div>
    );
  },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

const baseProps: React.ComponentProps<typeof ContactsBulkActionBar> = {
  selectedCount: 3,
  viewingDeleted: false,
  bulkActions: ["delete", "export"],
  canWriteMessaging: true,
  canExport: true,
  canDelete: true,
  selectedTargets: { waTargets: [], smsReady: [], emailReady: [] },
  onWhatsApp: vi.fn(),
  onSms: vi.fn(),
  onEmail: vi.fn(),
  onBulkExport: vi.fn(),
  onRequestBulkDelete: vi.fn(),
  onRequestBulkRestore: vi.fn(),
  onClearSelection: vi.fn(),
};

function render(overrides: Partial<React.ComponentProps<typeof ContactsBulkActionBar>> = {}) {
  lastExportAction = undefined;
  return renderToStaticMarkup(<ContactsBulkActionBar {...baseProps} {...overrides} />);
}

describe("ContactsBulkActionBar Component", () => {
  it("renders bulk action bar with selection count and actions", () => {
    const html = render();

    expect(html).toContain("contacts.selectedCount:3");
    expect(html).toContain("contacts.bulkDelete");
  });

  it("exposes the export action, wired to onBulkExport", async () => {
    const onBulkExport = vi.fn().mockResolvedValue(undefined);
    const html = render({ onBulkExport });

    expect(html).toContain("contacts.bulkExport");
    expect(lastExportAction?.label).toBe("contacts.bulkExport");
    await lastExportAction?.onClick();
    expect(onBulkExport).toHaveBeenCalledTimes(1);
  });

  it("omits the export action without canExport or the export bulk action", () => {
    expect(render({ canExport: false })).not.toContain("contacts.bulkExport");
    expect(render({ bulkActions: ["delete"] })).not.toContain("contacts.bulkExport");
  });

  it("flags the export action as pending while an export is in flight", () => {
    expect(render({ isExporting: true })).toContain('data-exporting="true"');
    expect(lastExportAction?.isPending).toBe(true);
    expect(render({ isExporting: false })).toContain('data-exporting="false"');
    expect(lastExportAction?.isPending).toBe(false);
  });
});
