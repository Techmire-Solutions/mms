import { describe, expect, it } from "vitest";
import { rowToJobRecord } from "../db/repositories/backgroundJobQueryRepository.js";

describe("rowToJobRecord date and payload mapping resilience", () => {
  it("correctly maps standard Date objects", () => {
    const row = {
      id: "job-1",
      moduleId: "contacts",
      kind: "export",
      status: "completed",
      label: "Export Contacts",
      hasDownload: true,
      progressCurrent: 10,
      progressTotal: 10,
      error: null,
      errors: null,
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      completedAt: new Date("2026-06-01T12:01:00.000Z"),
    };

    const record = rowToJobRecord(row as never);
    expect(record.id).toBe("job-1");
    expect(record.createdAt).toBe("2026-06-01T12:00:00.000Z");
    expect(record.completedAt).toBe("2026-06-01T12:01:00.000Z");
    expect(record.hasDownload).toBe(true);
    expect(record.progress).toEqual({ current: 10, total: 10 });
  });

  it("safely handles ISO string dates without throwing .toISOString is not a function", () => {
    const row = {
      id: "job-2",
      moduleId: "examinations",
      kind: "marks-import",
      status: "running",
      label: "Importing Marks",
      hasDownload: false,
      progressCurrent: 5,
      progressTotal: 20,
      error: null,
      errors: null,
      createdAt: "2026-06-02T10:00:00.000Z" as unknown as Date,
      completedAt: "2026-06-02T10:05:00.000Z" as unknown as Date,
    };

    const record = rowToJobRecord(row as never);
    expect(record.createdAt).toBe("2026-06-02T10:00:00.000Z");
    expect(record.completedAt).toBe("2026-06-02T10:05:00.000Z");
  });

  it("safely handles invalid Date instances without throwing RangeError", () => {
    const row = {
      id: "job-3",
      moduleId: "messaging",
      kind: "campaign-dispatch",
      status: "failed",
      label: "Dispatch Campaign",
      hasDownload: false,
      progressCurrent: null,
      progressTotal: null,
      error: "Gateway timeout",
      errors: [{ row: 1, reason: "Invalid phone number" }],
      createdAt: new Date("invalid-date"),
      completedAt: new Date("invalid-date"),
    };

    const record = rowToJobRecord(row as never);
    expect(typeof record.createdAt).toBe("string");
    expect(record.createdAt.length).toBeGreaterThan(0);
    expect(record.completedAt).toBeUndefined();
    expect(record.errors).toEqual([{ row: 1, reason: "Invalid phone number" }]);
  });

  it("safely handles null/undefined createdAt and completedAt", () => {
    const row = {
      id: "job-4",
      moduleId: "students",
      kind: "bulk-admit",
      status: "pending",
      label: "Admit Students",
      hasDownload: null,
      progressCurrent: null,
      progressTotal: null,
      error: null,
      errors: null,
      createdAt: null as unknown as Date,
      completedAt: null,
    };

    const record = rowToJobRecord(row as never);
    expect(typeof record.createdAt).toBe("string");
    expect(record.completedAt).toBeUndefined();
    expect(record.hasDownload).toBe(false);
  });
});
