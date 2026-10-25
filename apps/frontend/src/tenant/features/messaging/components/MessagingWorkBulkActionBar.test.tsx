import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessagingWorkBulkActionBar } from "./MessagingWorkBulkActionBar";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === "messaging.selectedCount") return `${params?.count} selected`;
      if (key === "messaging.exportLogs") return "Export";
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
    expect(html).toContain("Export (3)");
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
});
