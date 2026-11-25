import React, { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceRecord } from "@/lib/data/attendanceData";
import type {
  AttendanceRow,
  OfflinePayload,
} from "@/tenant/features/attendance/lib/markAttendanceTypes";

/**
 * Regression: the `saving` flag was only set around the submit path (and after an
 * await), so the footer buttons stayed enabled while `persistBatch` was in flight.
 * The persistence hook must set `saving` before awaiting the batch and clear it in
 * `finally`, so the UI can disable Save Draft and Submit for the whole request.
 */

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@mms/fe-core/notify", () => ({
  notify: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/tenant/features/attendance/lib/markAttendanceQueue", () => ({
  addAuditEntry: vi.fn(),
  loadQueue: vi.fn(() => []),
  saveQueue: vi.fn(),
  flushAuditQueue: vi.fn(),
}));

vi.mock("@/tenant/features/attendance/lib/markAttendanceRowUtils", () => ({
  attendanceRecordsFromRows: () => [
    {
      id: "att-1",
      studentId: "std-1",
      studentName: "Ali",
      rollNo: "1",
      classId: "cls-1",
      sessionName: "2026",
      date: "2026-01-01",
      status: "present",
      timeIn: "",
      timeOut: "",
      notes: "",
      createdAt: "",
      updatedAt: "",
    } as AttendanceRecord,
  ],
  buildOfflinePayload: (): OfflinePayload => ({
    classId: "cls-1",
    date: "2026-01-01",
    rows: [],
    geo: null,
    submittedBy: "admin",
    ts: "2026-01-01T00:00:00Z",
  }),
}));

import { useMarkAttendancePersistence } from "./useMarkAttendancePersistence";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let latest: ReturnType<typeof useMarkAttendancePersistence> | null = null;

function Harness({
  persistBatch,
  rows,
}: {
  persistBatch: () => Promise<AttendanceRecord[]>;
  rows: AttendanceRow[];
}) {
  const offlineQueueRef = useRef<OfflinePayload[]>([]);
  const hook = useMarkAttendancePersistence({
    filters: { classId: "cls-1", date: "2026-01-01" },
    role: "admin",
    rows,
    geo: null,
    isOffline: false,
    offlineQueue: offlineQueueRef.current,
    setOfflineQueue: vi.fn(),
    setIsDraft: vi.fn(),
    setSubmitted: vi.fn(),
    setSyncedMsg: vi.fn(),
    customFields: [],
    persistBatch,
  });
  latest = hook;
  return (
    <button type="button" data-testid="save-draft" onClick={() => void hook.handleSaveDraft()}>
      save draft
    </button>
  );
}

const rows: AttendanceRow[] = [
  {
    id: "std-1",
    studentId: "std-1",
    name: "Ali",
    status: "present",
    timeIn: "",
    timeOut: "",
    notes: "",
  } as unknown as AttendanceRow,
];

describe("useMarkAttendancePersistence saving flag", () => {
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

  it("is true while persistBatch is pending and false after it settles", async () => {
    let resolveBatch: (records: AttendanceRecord[]) => void = () => undefined;
    const persistBatch = vi.fn(
      () =>
        new Promise<AttendanceRecord[]>((resolve) => {
          resolveBatch = resolve;
        }),
    );

    await act(async () => {
      root.render(<Harness persistBatch={persistBatch} rows={rows} />);
    });
    expect(latest?.saving).toBe(false);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="save-draft"]')?.click();
    });
    expect(persistBatch).toHaveBeenCalledTimes(1);
    expect(latest?.saving).toBe(true);

    await act(async () => {
      resolveBatch([]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest?.saving).toBe(false);
  });
});
