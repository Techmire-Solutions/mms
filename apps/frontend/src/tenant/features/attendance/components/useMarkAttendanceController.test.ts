import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useMarkAttendanceController } from "../hooks/useMarkAttendanceController";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  useEnrollmentsCollection: vi.fn(() => [] as unknown[]),
  useStudentsByIds: vi.fn(() => ({ data: [] as unknown[] })),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useAttendanceConfig: () => ({
    statuses: [{ id: "present", label: "Present" }],
    customFields: [],
    orderedFields: [],
    isFieldEnabled: () => true,
  }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canWrite: true,
  }),
}));

vi.mock("../hooks/useAttendanceDaySubmission", () => ({
  useAttendanceDaySubmission: () => ({
    submission: { locked: false, submittedAt: "", submittedBy: null },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessionsCollection: () => [],
}));

vi.mock("@/tenant/hooks/collections/enrollments", () => ({
  useEnrollmentsCollection: mocks.useEnrollmentsCollection,
}));

vi.mock("@/tenant/hooks/collections/students", () => ({
  useStudentsByIds: mocks.useStudentsByIds,
}));

describe("useMarkAttendanceController Hook", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    mocks.useEnrollmentsCollection.mockClear();
    mocks.useStudentsByIds.mockClear();
    mocks.useEnrollmentsCollection.mockImplementation(() => []);
    mocks.useStudentsByIds.mockImplementation(() => ({ data: [] }));
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("initializes controller state with filters and records", async () => {
    let hookResult!: ReturnType<typeof useMarkAttendanceController>;

    function TestComponent() {
      hookResult = useMarkAttendanceController({
        filters: { classId: "cls-1", sessionId: "ses-1", facultyId: "", date: "2025-01-01" },
        role: "admin",
        records: [],
        persistBatch: vi.fn(),
      });
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult).toBeDefined();
    expect(hookResult.filters.classId).toBe("cls-1");
    expect(hookResult.filters.date).toBe("2025-01-01");
    expect(hookResult.canWriteAttendance).toBe(true);
    expect(mocks.useEnrollmentsCollection).toHaveBeenCalledWith({
      enabled: true,
      sessionId: "ses-1",
      classId: "cls-1",
    });
  });

  it("seeds a fresh roster as clean, so an untouched day never blocks navigation", async () => {
    mocks.useEnrollmentsCollection.mockImplementation(() => [
      { classId: "cls-1", studentId: "s1", status: "active", startOn: "2024-01-01" },
    ]);
    mocks.useStudentsByIds.mockImplementation(() => ({
      data: [{ id: "s1", name: "Ali", gender: "male", grNumber: "" }],
    }));
    let hookResult!: ReturnType<typeof useMarkAttendanceController>;

    function TestComponent() {
      hookResult = useMarkAttendanceController({
        filters: { classId: "cls-1", sessionId: "ses-1", facultyId: "", date: "2025-01-01" },
        role: "admin",
        records: [],
        persistBatch: vi.fn(),
      });
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult.rows.length).toBe(1);
    expect(hookResult.isDirty).toBe(false);
  });

  it("adopts existing marks as clean rows carrying their OCC identity", async () => {
    mocks.useEnrollmentsCollection.mockImplementation(() => [
      { classId: "cls-1", studentId: "s1", status: "active", startOn: "2024-01-01" },
    ]);
    mocks.useStudentsByIds.mockImplementation(() => ({
      data: [{ id: "s1", name: "Ali", gender: "male", grNumber: "" }],
    }));
    let hookResult!: ReturnType<typeof useMarkAttendanceController>;

    function TestComponent() {
      hookResult = useMarkAttendanceController({
        filters: { classId: "cls-1", sessionId: "ses-1", facultyId: "", date: "2025-01-01" },
        role: "admin",
        records: [
          {
            id: "rec-1",
            classId: "cls-1",
            date: "2025-01-01",
            studentId: "s1",
            studentName: "Ali",
            rollNo: "STU-001",
            status: "present",
            timeIn: "07:00",
            timeOut: "08:30",
            notes: "",
            version: 3,
          },
        ],
        persistBatch: vi.fn(),
      });
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult.rows[0]?.recordId).toBe("rec-1");
    expect(hookResult.rows[0]?.version).toBe(3);
    expect(hookResult.isDirty).toBe(false);
  });

  it("marks the grid dirty only after a real edit", async () => {
    mocks.useEnrollmentsCollection.mockImplementation(() => [
      { classId: "cls-1", studentId: "s1", status: "active", startOn: "2024-01-01" },
    ]);
    mocks.useStudentsByIds.mockImplementation(() => ({
      data: [{ id: "s1", name: "Ali", gender: "male", grNumber: "" }],
    }));
    let hookResult!: ReturnType<typeof useMarkAttendanceController>;

    function TestComponent() {
      hookResult = useMarkAttendanceController({
        filters: { classId: "cls-1", sessionId: "ses-1", facultyId: "", date: "2025-01-01" },
        role: "admin",
        records: [],
        persistBatch: vi.fn(),
      });
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });
    expect(hookResult.isDirty).toBe(false);

    await act(async () => {
      hookResult.setRow("s1", "notes", "late arrival");
    });
    expect(hookResult.isDirty).toBe(true);
  });
});
