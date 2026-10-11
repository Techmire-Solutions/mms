import { describe, expect, it, beforeEach } from "vitest";
import { loadQueue, saveQueue, addAuditEntry, getAuditLog } from "./markAttendanceQueue";
import type { OfflinePayload } from "./markAttendanceTypes";

describe("markAttendanceQueue utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads and saves offline queue in localStorage", () => {
    expect(loadQueue()).toEqual([]);

    const payload: OfflinePayload = {
      classId: "cls-1",
      date: "2025-01-01",
      rows: [],
      geo: null,
      submittedBy: "admin",
      ts: "2025-01-01T00:00:00Z",
    };

    saveQueue([payload]);
    expect(loadQueue()).toEqual([payload]);
  });

  it("adds and retrieves audit entries", () => {
    addAuditEntry("cls-1", "2025-01-01", {
      action: "submitted",
      count: 10,
    });

    const logs = getAuditLog("cls-1", "2025-01-01");
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe("submitted");
    expect(logs[0].count).toBe(10);
    expect(logs[0].ts).toBeDefined();
  });
});
