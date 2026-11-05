import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const h = vi.hoisted(() => ({
  detail: null as unknown,
  edit: null as unknown,
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, isRtl: false }),
}));
vi.mock("@/tenant/features/sessions/hooks/useSessions", () => ({
  useSessionDetailState: (summary: unknown) => ({
    session: summary ? (summary === h.detail ? h.detail : h.edit) : null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/tenant/features/sessions/components/SessionForm", () => ({
  SessionForm: () => <div data-testid="session-form" />,
}));
vi.mock("@/tenant/features/sessions/components/SessionDetail", () => ({
  SessionDetail: () => <div data-testid="session-detail" />,
}));
vi.mock("@/tenant/features/sessions/components/SessionLockOverrideDialog", () => ({
  SessionLockOverrideDialog: () => null,
}));
vi.mock("@/tenant/features/sessions/components/SessionsListConfirmDialogs", () => ({
  SessionsListConfirmDialogs: () => null,
}));
vi.mock("@/tenant/features/sessions/components/SessionsCsvImportDialog", () => ({
  SessionsCsvImportDialog: () => null,
}));

import { SessionsDialogLayer } from "./SessionsDialogLayer";

const props = {
  detailSession: null,
  canDelete: true,
  pendingDeleteId: null,
  confirmBulkDeleteOpen: false,
  confirmBulkRestoreOpen: false,
  selectedCount: 0,
  onCloseForm: vi.fn(),
  onSave: vi.fn(),
  onCloseDetail: vi.fn(),
  onUpdate: vi.fn(),
  onEdit: vi.fn(),
  onRestore: vi.fn(),
  onPendingDeleteChange: vi.fn(),
  onConfirmDelete: vi.fn(),
  onBulkDeleteOpenChange: vi.fn(),
  onConfirmBulkDelete: vi.fn(),
  onBulkRestoreOpenChange: vi.fn(),
  onConfirmBulkRestore: vi.fn(),
};

describe("SessionsDialogLayer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders the create form when there is no edit session", async () => {
    await act(async () => {
      root.render(<SessionsDialogLayer {...props} showForm={true} editSession={null} />);
      await Promise.resolve();
    });

    expect(container.querySelector("[data-testid='session-form']")).not.toBeNull();
  });
});
