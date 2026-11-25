import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultyPageOverlays } from "./FacultyPageOverlays";

vi.mock("../host/sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../host/sessions")>();
  return {
    ...actual,
    useSessions: () => ({ data: [] }),
  };
});

vi.mock("../hooks/useBranding", () => ({
  useBranding: () => ({
    madrasaName: "Test Madrasa",
  }),
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./FacultyPageConfirmDialogs", () => ({
  FacultyPageConfirmDialogs: ({ bulkDeleteOpen }: { bulkDeleteOpen?: boolean }) => (
    <div data-testid="confirm-dialogs">dialogs-rendered:{String(bulkDeleteOpen)}</div>
  ),
}));

const defaultProps = {
  showForm: false,
  editFaculty: null,
  onCloseForm: vi.fn(),
  onSave: vi.fn(),
  viewFaculty: null,
  onCloseView: vi.fn(),
  onEditFromDrawer: vi.fn(),
  onRestoreFromDrawer: vi.fn(),
  messagingTarget: null,
  onCloseComposer: vi.fn(),
  openComposer: vi.fn(),
  canWriteMessaging: true,
  canWrite: true,
  canDelete: true,
  bulkDeleteOpen: false,
  onBulkDeleteOpenChange: vi.fn(),
  selectedCount: 0,
  onConfirmBulkDelete: vi.fn(),
  deleteTarget: null,
  onDeleteTargetOpenChange: vi.fn(),
  onConfirmSingleDelete: vi.fn(),
  bulkRestoreOpen: false,
  onBulkRestoreOpenChange: vi.fn(),
  onConfirmBulkRestore: vi.fn(),
  idCardFaculty: [],
  onCloseIdCards: vi.fn(),
};

describe("FacultyPageOverlays Component", () => {
  it("renders confirm dialogs and overlays structure", () => {
    const html = renderToStaticMarkup(
      <FacultyPageOverlays {...defaultProps} bulkDeleteOpen={true} />,
    );

    expect(html).toContain("dialogs-rendered:true");
  });
});
