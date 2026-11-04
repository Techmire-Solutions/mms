/**
 * Faculty write actions — contract envelope guards.
 *
 * The ts-rest fetcher throws only for 401/403; every other status resolves as
 * `{ status, body }`. A write helper that does not inspect the envelope reports
 * a 409/400/500 as success (the OCC conflict this module claims to surface).
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Faculty } from "@mms/shared";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  create: vi.fn(),
  del: vi.fn(),
  restore: vi.fn(),
  bulkDelete: vi.fn(),
  bulkRestore: vi.fn(),
  bulkStatus: vi.fn(),
  bulkSpecialization: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  archivedWithUndo: vi.fn(),
  reportClientError: vi.fn(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: (...args: unknown[]) => mocks.success(...args),
    error: (...args: unknown[]) => mocks.error(...args),
    warning: vi.fn(),
    archivedWithUndo: (...args: unknown[]) => mocks.archivedWithUndo(...args),
  },
}));

vi.mock("@/lib/clientErrorReporting", () => ({
  reportClientError: (...args: unknown[]) => mocks.reportClientError(...args),
}));

vi.mock("@/hooks/useMessageComposerState", () => ({
  useMessageComposerState: () => ({
    messagingTarget: null,
    openComposer: vi.fn(),
    closeComposer: vi.fn(),
    canWriteMessaging: false,
  }),
}));

vi.mock("@/tenant/features/faculty/hooks/useFaculty", () => ({
  useFacultyMutations: () => ({
    createFaculty: { mutateAsync: mocks.create },
    updateFaculty: { mutateAsync: mocks.update },
    deleteFaculty: { mutateAsync: mocks.del },
    restoreFaculty: { mutateAsync: mocks.restore },
    bulkDeleteFaculty: { mutateAsync: mocks.bulkDelete },
    bulkRestoreFaculty: { mutateAsync: mocks.bulkRestore },
    bulkUpdateFacultyStatus: { mutateAsync: mocks.bulkStatus },
    bulkUpdateFacultySpecialization: mocks.bulkSpecialization,
    isBulkSpecializationPending: false,
  }),
}));

import { useFacultyPageActions } from "./useFacultyPageActions";

type Actions = ReturnType<typeof useFacultyPageActions>;

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Harness({
  editFaculty,
  onActions,
}: {
  editFaculty?: Faculty | null;
  onActions: (actions: Actions) => void;
}) {
  onActions(useFacultyPageActions({ editFaculty }));
  return null;
}

const EXISTING = {
  id: "f1",
  name: "Ustadh A",
  contactId: "c1",
  updatedAt: "2026-11-01T00:00:00.000Z",
} as Faculty;

describe("useFacultyPageActions contract guards", () => {
  let container: HTMLDivElement;
  let root: Root;
  let actions: Actions;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(editFaculty?: Faculty | null) {
    act(() => {
      root.render(
        <Harness
          editFaculty={editFaculty}
          onActions={(next) => {
            actions = next;
          }}
        />,
      );
    });
    return actions;
  }

  it("saves an edit on 200 and returns the envelope entity", async () => {
    mocks.update.mockResolvedValue({ status: 200, body: { faculty: EXISTING } });
    const hook = render(EXISTING);

    const saved = await hook.handleSaveFaculty(EXISTING);

    expect(saved).toMatchObject({ id: "f1" });
    expect(mocks.success).toHaveBeenCalledWith("faculty.toast.updated");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { id: "f1" },
        extraHeaders: { "x-expected-updated-at": EXISTING.updatedAt },
      }),
    );
  });

  it("rejects an OCC 409 instead of announcing a successful update", async () => {
    mocks.update.mockResolvedValue({
      status: 409,
      body: { type: "conflict", message: "This faculty member was changed by someone else." },
    });
    const hook = render(EXISTING);

    await expect(hook.handleSaveFaculty(EXISTING)).rejects.toMatchObject({ status: 409 });
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("rejects a failed create instead of announcing a new record", async () => {
    mocks.create.mockResolvedValue({
      status: 500,
      body: { type: "server_error", message: "Failed to create faculty member" },
    });
    const hook = render(null);

    await expect(hook.handleSaveFaculty({ id: "new", name: "B" } as Faculty)).rejects.toMatchObject(
      { status: 500 },
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("does not announce an archive when delete returns a 409", async () => {
    mocks.del.mockResolvedValue({
      status: 409,
      body: { type: "conflict", message: "Reassign subordinates before deletion" },
    });
    const hook = render(null);

    await expect(hook.handleDelete("f1")).rejects.toMatchObject({ status: 409 });
    expect(mocks.archivedWithUndo).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(
      "faculty.toast.conflict",
      expect.objectContaining({ description: "Reassign subordinates before deletion" }),
    );
  });

  it("keeps partial bulk results honest on a failed bulk call", async () => {
    mocks.bulkStatus.mockResolvedValue({
      status: 403,
      body: { type: "forbidden", message: "Insufficient permissions" },
    });
    const hook = render(null);

    // 403 is thrown by the transport, so simulate the fetcher contract here.
    mocks.bulkStatus.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(hook.handleBulkStatusChange(["f1"], "active")).rejects.toThrow("Forbidden");
  });
});
