import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAttendancePageActions } from "./useAttendancePageActions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/useMessageComposerState", () => ({
  useMessageComposerState: () => ({
    messagingTarget: null,
    openComposer: vi.fn(),
    closeComposer: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/attendance/hooks/useAttendance", () => ({
  useAttendanceMutations: () => ({
    bulkUpsert: { mutateAsync: vi.fn().mockResolvedValue({}) },
    updateRecord: { mutateAsync: vi.fn().mockResolvedValue({}) },
    deleteRecord: { mutateAsync: vi.fn().mockResolvedValue({}) },
    restoreRecord: { mutateAsync: vi.fn().mockResolvedValue({}) },
    bulkDeleteRecords: { mutateAsync: vi.fn().mockResolvedValue({ body: { succeeded: 2 } }) },
    bulkRestoreRecords: { mutateAsync: vi.fn().mockResolvedValue({ body: { succeeded: 2 } }) },
  }),
}));

describe("useAttendancePageActions Hook", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("handles update, delete, restore, and bulk actions for attendance records", async () => {
    let hookResult!: ReturnType<typeof useAttendancePageActions>;

    function TestComponent() {
      hookResult = useAttendancePageActions();
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult).toBeDefined();

    await act(async () => {
      await hookResult.handleDeleteRecord("rec-1");
      await hookResult.handleRestoreRecord("rec-1");
      await hookResult.handleBulkDeleteRecords(["rec-1", "rec-2"]);
      await hookResult.handleBulkRestoreRecords(["rec-1", "rec-2"]);
    });

    expect(typeof hookResult.handleMessageAttendance).toBe("function");
  });
});
