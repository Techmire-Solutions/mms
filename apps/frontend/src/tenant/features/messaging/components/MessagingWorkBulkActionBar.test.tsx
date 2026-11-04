import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessagingWorkBulkActionBar } from "./MessagingWorkBulkActionBar";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === "messaging.selectedCount") return `${params?.count} selected`;
      if (key === "messaging.exportLogs") return "Export";
      if (key === "messaging.exportLogsFiltered") return "Export matching logs";
      if (key === "messaging.clearLogs") return "Clear";
      if (key === "messaging.resend") return "Resend";
      if (key === "common.deselect") return "Deselect";
      return key;
    },
  }),
}));

describe("MessagingWorkBulkActionBar", () => {
  it("given write permissions, should render selected count, export, resend, and clear logs via BulkSelectionBar", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(
      <MessagingWorkBulkActionBar
        selectedCount={3}
        canWrite={true}
        canClearLogs={true}
        onClearSelection={() => {}}
        onBulkExport={() => {}}
        onBulkResend={() => {}}
        onClearLogsRequest={() => {}}
      />,
    );

    // Assert
    expect(html).toContain("3 selected");
    expect(html).toContain("Deselect");
    expect(html).toContain("Resend");
    // Export runs the active filters, so it must not advertise the selection.
    expect(html).toContain("Export matching logs");
    expect(html).not.toContain("Export (3)");
    expect(html).toContain("Clear");
  });

  it("given no write or clear permissions, should hide export and clear actions", () => {
    // Arrange / Act
    const html = renderToStaticMarkup(
      <MessagingWorkBulkActionBar
        selectedCount={2}
        canWrite={false}
        canClearLogs={false}
        onClearSelection={() => {}}
      />,
    );

    // Assert
    expect(html).toContain("2 selected");
    expect(html).toContain("Deselect");
    expect(html).not.toContain("Export");
    expect(html).not.toContain("Clear");
  });

  it("restores in the archived view instead of archiving or exporting", () => {
    const onBulkRestoreRequest = vi.fn();
    const html = renderToStaticMarkup(
      <MessagingWorkBulkActionBar
        selectedCount={2}
        canWrite={true}
        canClearLogs={false}
        viewingDeleted={true}
        canRestoreLogs={true}
        onBulkRestoreRequest={onBulkRestoreRequest}
        onClearSelection={() => {}}
        onBulkExport={() => {}}
        onBulkResend={() => {}}
        onClearLogsRequest={() => {}}
      />,
    );

    expect(html).toContain("messaging.restoreLog");
    // Archived logs are not exported through this bar, and the archive action
    // must not appear while browsing archived rows.
    expect(html).not.toContain("messaging.clearLogs");
    expect(html).not.toContain("Export matching logs");
  });
});
