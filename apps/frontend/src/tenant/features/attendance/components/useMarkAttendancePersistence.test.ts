import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useMarkAttendancePersistence } from "../hooks/useMarkAttendancePersistence";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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

describe("useMarkAttendancePersistence Hook", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    localStorage.clear();
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("handles saving draft and submitting attendance online", async () => {
    const persistBatch = vi.fn().mockResolvedValue(undefined);
    const setIsDraft = vi.fn();
    const setSubmitted = vi.fn();
    let hookResult: any = null;

    function TestComponent() {
      hookResult = useMarkAttendancePersistence({
        filters: { classId: "cls-1", date: "2025-01-01" },
        role: "teacher",
        rows: [
          {
            studentId: "std-1",
            name: "Bilal",
            rollNo: "GR-01",
            status: "present",
            timeIn: "08:00",
            timeOut: "12:00",
            notes: "",
          },
        ],
        geo: null,
        isOffline: false,
        offlineQueue: [],
        setOfflineQueue: vi.fn(),
        setIsDraft,
        setSubmitted,
        setSyncedMsg: vi.fn(),
        customFields: [],
        persistBatch,
      });
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult).toBeDefined();

    await act(async () => {
      await hookResult.handleSaveDraft();
    });
    expect(persistBatch).toHaveBeenCalled();
    expect(setIsDraft).toHaveBeenCalledWith(true);

    await act(async () => {
      await hookResult.handleSubmit();
    });
    expect(persistBatch).toHaveBeenCalledTimes(2);
    expect(setSubmitted).toHaveBeenCalledWith(true);
  });
});
