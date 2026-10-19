import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkAttendance } from "./MarkAttendance";

vi.mock("../hooks/useMarkAttendanceController", () => ({
  useMarkAttendanceController: (props: { filters: Record<string, unknown> }) => ({
    filters: props.filters,
    t: (key: string) => key,
    isOffline: false,
    offlineQueue: [],
    handleSync: vi.fn(),
    syncedMsg: false,
    showFaceAI: false,
    setShowFaceAI: vi.fn(),
    classInfo: { name: "Class 1A" },
    sessionInfo: { name: "2024-2025" },
    submitted: false,
    isDraft: false,
    geo: null,
    requestGeo: vi.fn(),
    markAll: vi.fn(),
    statuses: [],
    stats: {},
    search: "",
    setSearch: vi.fn(),
    rows: [],
    filteredRows: [],
    orderedFields: [],
    isFieldEnabled: () => true,
    setRow: vi.fn(),
    canWriteAttendance: true,
    handleSaveDraft: vi.fn(),
    handleSubmit: vi.fn(),
  }),
}));

vi.mock("./MarkAttendanceOfflineBanner", () => ({
  MarkAttendanceOfflineBanner: () => <div data-testid="offline-banner">Offline Banner</div>,
}));

vi.mock("./MarkAttendanceClassBar", () => ({
  MarkAttendanceClassBar: () => <div data-testid="class-bar">Class Bar</div>,
}));

vi.mock("./MarkAttendanceStatsStrip", () => ({
  MarkAttendanceStatsStrip: () => <div data-testid="stats-strip">Stats Strip</div>,
}));

vi.mock("./MarkAttendanceGrid", () => ({
  MarkAttendanceGrid: () => <div data-testid="grid">Attendance Grid</div>,
}));

vi.mock("@/tenant/features/attendance/hooks/useInstructionalDayStatus", () => ({
  useInstructionalDayStatus: () => ({
    instructional: true,
    allowExtraClass: false,
    isLoading: false,
  }),
}));

vi.mock("./MarkAttendanceActions", () => ({
  MarkAttendanceActions: () => <div data-testid="actions">Attendance Actions</div>,
}));

describe("MarkAttendance Component", () => {
  it("renders empty state when no classId is selected", () => {
    const html = renderToStaticMarkup(
      <MarkAttendance
        filters={{ classId: "", sessionId: "", facultyId: "", date: "2025-01-01" }}
        role="admin"
        records={[]}
        persistBatch={vi.fn()}
      />,
    );

    expect(html).toContain("attendance.mark.selectClassTitle");
  });

  it("renders attendance marking interface when class is selected", () => {
    const html = renderToStaticMarkup(
      <MarkAttendance
        filters={{ classId: "cls-1", sessionId: "ses-1", facultyId: "", date: "2025-01-01" }}
        role="admin"
        records={[]}
        persistBatch={vi.fn()}
      />,
    );

    expect(html).toContain("Class Bar");
    expect(html).toContain("Stats Strip");
    expect(html).toContain("Attendance Grid");
    expect(html).toContain("Attendance Actions");
  });
});
