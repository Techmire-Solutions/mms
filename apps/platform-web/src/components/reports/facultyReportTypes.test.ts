import { describe, expect, it } from "vitest";
import {
  computeFacultyWorkload,
  summarizeFacultyWorkload,
} from "@/tenant/features/reports/hooks/facultyReportMetrics";
import { mapFacultyRow } from "./facultyReportTypes";

describe("mapFacultyRow", () => {
  it("maps a hydrated faculty member to the roster row shape", () => {
    const row = mapFacultyRow({
      id: "t1",
      contactId: 99,
      name: "Maulana Ahmed",
      employeeId: "EMP-004",
      specialization: "Hifz",
      status: "active",
      qualification: "Alim",
      joinDate: "2024-01-15",
      gender: "male",
    });
    expect(row.id).toBe("t1");
    expect(row.name).toBe("Maulana Ahmed");
    expect(row.employeeId).toBe("EMP-004");
    expect(row.specialization).toBe("Hifz");
    expect(row.status).toBe("active");
    expect(row.qualification).toBe("Alim");
    expect(row.gender).toBe("male");
    expect(row.joinDate).toContain("15");
    expect(row.joinDate).toContain("2024");
  });

  it("falls back to defaults for missing optional fields", () => {
    const row = mapFacultyRow({ id: "t2", contactId: "c1" } as never);
    expect(row.name).toBe("");
    expect(row.employeeId).toBe("—");
    expect(row.specialization).toBe("—");
    expect(row.status).toBe("inactive");
    expect(row.qualification).toBe("—");
    expect(row.joinDate).toBe("—");
    expect(row.gender).toBe("—");
  });

  it("omits the join date column when absent", () => {
    const row = mapFacultyRow({
      id: "t3",
      contactId: 1,
      name: "Ustadha Fatima",
      status: "on_leave",
    });
    expect(row.joinDate).toBe("—");
  });
});

describe("computeFacultyWorkload and summarizeFacultyWorkload", () => {
  it("aggregates workload across classes and sessions and sorts descending by totalStudents", () => {
    const sessions = [
      {
        id: "s1",
        classes: [
          { id: "c1", enrolled: 15, facultyId: "f1", facultyName: "Sheikh Ali" },
          { id: "c2", enrolled: 10, facultyId: "f2", facultyName: "Sheikh Bilal" },
        ],
      },
      {
        id: "s2",
        classes: [{ id: "c3", enrolled: 20, facultyId: "f1", facultyName: "Sheikh Ali" }],
      },
    ];

    const workload = computeFacultyWorkload(sessions, (_id, name) => name || "Unassigned");

    expect(workload).toHaveLength(2);
    expect(workload[0].faculty).toBe("Sheikh Ali");
    expect(workload[0].totalStudents).toBe(35);
    expect(workload[0].classes).toBe(2);
    expect(workload[0].sessions).toBe(2);

    expect(workload[1].faculty).toBe("Sheikh Bilal");
    expect(workload[1].totalStudents).toBe(10);

    const summary = summarizeFacultyWorkload(workload);
    expect(summary.totalFaculty).toBe(2);
    expect(summary.totalStudents).toBe(45);
    expect(summary.totalClasses).toBe(3);
    expect(summary.avgStudents).toBe("22.5");
  });
});
