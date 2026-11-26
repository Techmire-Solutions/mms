import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceRecord } from "../lib/attendanceData";
import { AttendanceCard } from "../components/AttendanceCard";
import { useAttendanceRecordsState } from "./useAttendanceRecordsState";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const notifyMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@mms/fe-core/notify", () => ({ notify: notifyMock }));
vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../host/useAttendanceConfig", () => ({
  useAttendanceConfig: () => ({ statuses: [] }),
}));
vi.mock("../host/sessionsCollection", () => ({
  useSessionsCollection: () => [],
}));
vi.mock("../host/usePermissions", () => ({
  useModulePermissions: () => ({ canWrite: true, canDelete: true }),
}));
vi.mock("./useAttendance", () => ({
  useAttendancePaginated: () => ({
    data: { records: [], total: 0, page: 1, limit: 20, hasMore: false },
    isFetching: false,
  }),
}));

const lateRecord: AttendanceRecord = {
  id: "late-1",
  studentId: "std-1",
  studentName: "Bilal Ahmad",
  rollNo: "GR-001",
  classId: "cls-1",
  sessionName: "Spring 2025",
  date: "2026-03-02",
  status: "late",
  timeIn: "",
  timeOut: "",
  notes: "",
  createdAt: "2026-03-02T08:00:00Z",
  updatedAt: "2026-03-02T08:00:00Z",
};

type State = ReturnType<typeof useAttendanceRecordsState>;

function Harness({
  onUpdateRecord,
}: {
  onUpdateRecord: (record: AttendanceRecord) => Promise<void>;
}): React.JSX.Element {
  const state = useAttendanceRecordsState({
    filters: { sessionId: "", classId: "", facultyId: "", date: "" } as never,
    onUpdateRecord,
    onDeleteRecord: vi.fn(),
    onRestoreRecord: vi.fn(),
    onBulkDeleteRecords: vi.fn(),
    onBulkRestoreRecords: vi.fn(),
  });
  latestState = state;

  return (
    <AttendanceCard
      attendanceRecord={lateRecord}
      isColumnVisible={() => true}
      editingRecord={state.editingRecord}
      editingRecordError={state.editingRecordError}
      statuses={[]}
      updateDraft={state.updateDraft}
      renderRowActions={() => null}
      classLabel={(classId) => classId}
      selectedIds={[]}
      canDelete={false}
      onToggleSelectedRecord={vi.fn()}
      reducedMotion
      t={state.t}
    />
  );
}

let latestState: State;

describe("useAttendanceRecordsState inline edit errors", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    notifyMock.error.mockClear();
    notifyMock.success.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("shows the policy error inline and keeps a late row without time-in in edit mode", async () => {
    const onUpdateRecord = vi.fn().mockResolvedValue(undefined);

    await act(async () => root.render(<Harness onUpdateRecord={onUpdateRecord} />));
    await act(async () => latestState.setEditingRecord(lateRecord));
    await act(async () => {
      await latestState.saveEditingRecord();
    });

    // Inline, not a toast: the row itself explains what to fix.
    expect(notifyMock.error).not.toHaveBeenCalled();
    expect(onUpdateRecord).not.toHaveBeenCalled();
    expect(latestState.editingRecordError).toBe("attendance.mark.validationTimeIn");
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe("attendance.mark.validationTimeIn");
    // Still editing: the input the user must fix is still on screen.
    expect(latestState.editingRecord?.id).toBe("late-1");
    expect(container.querySelector("#attendance-mobile-time-in-late-1")).not.toBeNull();
  });

  it("reports a failed row save inline and clears it when the draft is edited or cancelled", async () => {
    const onUpdateRecord = vi.fn().mockRejectedValue(new Error("Server rejected the row"));

    await act(async () => root.render(<Harness onUpdateRecord={onUpdateRecord} />));
    await act(async () =>
      latestState.setEditingRecord({ ...lateRecord, status: "present", timeIn: "08:00" }),
    );
    await act(async () => {
      await latestState.saveEditingRecord();
    });

    expect(latestState.editingRecordError).toBe("Server rejected the row");
    expect(latestState.editingRecord).not.toBeNull();

    await act(async () => latestState.updateDraft("notes", "fixing"));
    expect(latestState.editingRecordError).toBeNull();

    await act(async () => latestState.setEditingRecord(null));
    expect(latestState.editingRecordError).toBeNull();
    expect(latestState.editingRecord).toBeNull();
  });
});
