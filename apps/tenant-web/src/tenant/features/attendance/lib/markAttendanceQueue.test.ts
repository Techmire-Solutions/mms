import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushAuditQueue, getAuditLog, queueAuditEntry } from "./markAttendanceQueue";

/**
 * The audit trail must not block rapid entry: entries are buffered and written once per burst instead
 * of a synchronous localStorage read/modify/write on every keystroke.
 */
describe("buffered attendance audit log", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("coalesces rapid edits into a single persisted write", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    for (let index = 0; index < 20; index += 1) {
      queueAuditEntry("cls-1", "2026-03-02", {
        action: "edit",
        studentId: `std-${index}`,
        field: "notes",
        from: "",
        to: "x",
        by: "teacher",
      });
    }
    expect(setItem).not.toHaveBeenCalled();

    flushAuditQueue();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(getAuditLog("cls-1", "2026-03-02")).toHaveLength(20);
    setItem.mockRestore();
  });

  it("flushes automatically on idle/timeout", () => {
    queueAuditEntry("cls-1", "2026-03-02", { action: "bulk_mark", status: "present", count: 3 });
    expect(getAuditLog("cls-1", "2026-03-02")).toHaveLength(0);
    vi.runAllTimers();
    expect(getAuditLog("cls-1", "2026-03-02")).toHaveLength(1);
  });
});
