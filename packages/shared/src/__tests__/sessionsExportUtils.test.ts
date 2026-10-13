import { describe, expect, it } from "vitest";
import {
  resolveAllSessionExportColumns,
  filterSessionExportColumnsForViewer,
  extractSessionCell,
  buildSessionsExportRows,
  type SessionExportColumn,
} from "../sessions/sessionsExportUtils.js";
import type { Session } from "../sessions/sessionTypes.js";

describe("sessionsExportUtils", () => {
  const sampleSession: Session & { customFields?: Record<string, unknown> } = {
    id: "sess-1",
    name: "Summer Camp 2026",
    type: "summer",
    status: "active",
    startDate: "2026-06-01",
    endDate: "2026-07-31",
    baseFee: 5000,
    currency: "PKR",
    description: "Annual summer hifz intensive camp",
    classes: [
      { id: "c1", name: "Hifz Intensive A", maxStudents: 25, enrolled: 20 } as never,
      { id: "c2", name: "Tajweed Fundamentals", maxStudents: 20, enrolled: 15 } as never,
    ],
    faculty: [
      {
        id: "f1",
        facultyId: "fac-1",
        facultyName: "Qari Usama",
        role: "coordinator",
        status: "active",
      } as never,
      {
        id: "f2",
        facultyId: "fac-2",
        facultyName: "Sheikh Abdullah",
        role: "teacher",
        status: "active",
      } as never,
    ],
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-02T00:00:00Z",
    customFields: {
      location: "Main Campus",
      meta: { approvedBy: "Board" },
    },
  };

  it("resolves all columns including default form tabs and custom fields", () => {
    const settings = {
      fields: {
        location: { label: "Campus Location", enabled: true },
        inactiveField: { label: "Inactive", enabled: false },
      },
    };
    const all = resolveAllSessionExportColumns(settings as never);
    const ids = all.map((c) => c.id);
    expect(ids).toContain("name");
    expect(ids).toContain("duration");
    expect(ids).toContain("enrolled");
    expect(ids).toContain("capacity");
    expect(ids).toContain("classNames");
    expect(ids).toContain("facultyNames");
    expect(ids).toContain("location");
    expect(ids).not.toContain("inactiveField");
  });

  it("filters columns based on field enablement settings", () => {
    const settings = {
      fields: {
        description: { enabled: false },
        capacity: { enabled: true },
      },
    };
    const filtered = filterSessionExportColumnsForViewer([], settings as never);
    const ids = filtered.map((c) => c.id);
    expect(ids).toContain("name");
    expect(ids).toContain("capacity");
    expect(ids).not.toContain("description");
  });

  it("extracts cells from all tabs, classes, faculty, and custom fields non-destructively", () => {
    expect(extractSessionCell(sampleSession, "name")).toBe("Summer Camp 2026");
    expect(extractSessionCell(sampleSession, "duration")).toBe("2026-06-01 → 2026-07-31");
    expect(extractSessionCell(sampleSession, "enrolled")).toBe("35");
    expect(extractSessionCell(sampleSession, "capacity")).toBe("45");
    expect(extractSessionCell(sampleSession, "classesCount")).toBe("2");
    expect(extractSessionCell(sampleSession, "classNames")).toBe(
      "Hifz Intensive A; Tajweed Fundamentals",
    );
    expect(extractSessionCell(sampleSession, "facultyCount")).toBe("2");
    expect(extractSessionCell(sampleSession, "facultyNames")).toBe("Qari Usama; Sheikh Abdullah");
    expect(extractSessionCell(sampleSession, "baseFee")).toBe("5000");
    expect(extractSessionCell(sampleSession, "location")).toBe("Main Campus");
    expect(extractSessionCell(sampleSession, "meta")).toBe('{"approvedBy":"Board"}');
  });

  it("builds CSV export grid correctly", () => {
    const columns: SessionExportColumn[] = [
      { id: "name", label: "Session" },
      { id: "enrolled", label: "Students" },
    ];
    const grid = buildSessionsExportRows([sampleSession], columns);
    expect(grid).toHaveLength(2);
    expect(grid[0]).toEqual(["Session", "Students"]);
    expect(grid[1]).toEqual(["Summer Camp 2026", "35"]);
  });
});
