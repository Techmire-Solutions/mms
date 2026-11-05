import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentsPageOverlays } from "./StudentsPageOverlays";

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessionsCollection: () => [],
}));

// Branding is routed (it reads `useLocation` for scoped settings); the overlay only needs the name.
vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({ madrasaName: "Demo Madrasa" }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/students/components/StudentsPageConfirmDialogs", () => ({
  StudentsPageConfirmDialogs: ({ bulkDeleteOpen }: { bulkDeleteOpen?: boolean }) => (
    <div data-testid="confirm-dialogs">dialogs-rendered:{String(bulkDeleteOpen)}</div>
  ),
}));

const defaultProps = {
  showStudentForm: false,
  editStudent: null,
  onCloseForm: vi.fn(),
  onSave: vi.fn(),
  viewStudent: null,
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
  idCardStudents: [],
  onCloseIdCards: vi.fn(),
};

describe("StudentsPageOverlays Component", () => {
  it("renders confirm dialogs and overlays structure", () => {
    const html = renderToStaticMarkup(
      <StudentsPageOverlays {...defaultProps} bulkDeleteOpen={true} />,
    );

    expect(html).toContain("dialogs-rendered:true");
  });
});
