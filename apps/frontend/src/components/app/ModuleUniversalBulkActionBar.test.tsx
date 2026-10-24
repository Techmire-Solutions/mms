import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GraduationCap } from "lucide-react";
import { ModuleUniversalBulkActionBar } from "./ModuleUniversalBulkActionBar";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "hasanat.selectedCount" || key === "hasanat.bulkRestore") return "";
      if (params?.count != null) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

describe("ModuleUniversalBulkActionBar", () => {
  it("renders nothing when selectedCount is 0", () => {
    const html = renderToStaticMarkup(
      <ModuleUniversalBulkActionBar
        selectedCount={0}
        viewingDeleted={false}
        canDelete={true}
        onClearSelection={vi.fn()}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
        leadingIcon={GraduationCap}
        i18nNamespace="students"
      />,
    );
    expect(html).toBe("");
  });

  it("renders count label, delete button, and messaging channels in active mode", () => {
    const html = renderToStaticMarkup(
      <ModuleUniversalBulkActionBar
        selectedCount={4}
        viewingDeleted={false}
        canDelete={true}
        canWriteMessaging={true}
        bulkActions={["delete", "whatsapp", "sms", "email"]}
        onClearSelection={vi.fn()}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
        onWhatsApp={vi.fn()}
        onSms={vi.fn()}
        onEmail={vi.fn()}
        messagingTargets={{
          waTargets: [{ id: "1" }],
          smsReady: [{ id: "1" }],
          emailReady: [{ id: "1" }],
        }}
        leadingIcon={GraduationCap}
        i18nNamespace="students"
      />,
    );
    expect(html).toContain("students.selectedCount:4");
    expect(html).toContain("common.delete");
    expect(html).toContain("common.deselect");
    expect(html).toContain("messaging.channel.whatsapp");
  });

  it("renders restore button in viewingDeleted mode", () => {
    const html = renderToStaticMarkup(
      <ModuleUniversalBulkActionBar
        selectedCount={2}
        viewingDeleted={true}
        canDelete={true}
        onClearSelection={vi.fn()}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
        leadingIcon={GraduationCap}
        i18nNamespace="students"
      />,
    );
    expect(html).toContain("students.selectedCount:2");
    expect(html).toContain("students.bulkRestore");
  });

  it("falls back to trash-scoped i18n keys when primary keys are missing", () => {
    const html = renderToStaticMarkup(
      <ModuleUniversalBulkActionBar
        selectedCount={5}
        viewingDeleted={false}
        canDelete={true}
        leadingIcon={GraduationCap}
        i18nNamespace="hasanat"
        onClearSelection={vi.fn()}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
      />,
    );
    expect(html).toContain("hasanat.trash.selected:5");
  });

  it("renders exportAction pass-through with its explicit label", () => {
    const html = renderToStaticMarkup(
      <ModuleUniversalBulkActionBar
        selectedCount={3}
        viewingDeleted={false}
        canDelete={true}
        leadingIcon={GraduationCap}
        i18nNamespace="students"
        onClearSelection={vi.fn()}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
        exportAction={{ label: "Export CSV", onClick: vi.fn() }}
      />,
    );
    expect(html).toContain("Export CSV");
  });
});
