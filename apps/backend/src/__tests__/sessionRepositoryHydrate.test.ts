import { describe, expect, it, vi } from "vitest";
import { hydrateSessionsListAggregated } from "../db/repositories/sessionRepositoryHydrate.js";

describe("sessionRepositoryHydrate", () => {
  it("hydrateSessionsListAggregated hydrates classes, faculty, fees, schedules, and scholarships in 1 SQL query", async () => {
    const mockSessionRow = {
      id: "s1",
      workspaceSubdomain: "test-madrasa",
      name: "Spring 2026",
      type: "academic",
      status: "active",
      startDate: new Date(),
      endDate: new Date(),
      baseFee: "100.00",
      currency: "USD",
      description: "Spring term",
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      restoredAt: null,
      restoredBy: null,
      deletedWithCascade: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockFacultyRow = {
      id: "sf1",
      sessionId: "s1",
      workspaceSubdomain: "test-madrasa",
      facultyId: "f1",
      facultyName: "Teacher A",
      role: "instructor",
      status: "active",
      createdAt: new Date().toISOString(),
    };

    const mockClassRow = {
      id: "sc1",
      sessionId: "s1",
      workspaceSubdomain: "test-madrasa",
      name: "Tajweed 101",
      gender: "all",
      ageCalcDate: null,
      ageMin: 10,
      ageMax: 18,
      capacity: 30,
      enrolled: 15,
      enrollmentDeadline: null,
      status: "active",
      facultyId: "f1",
      facultyName: "Teacher A",
      room: "Room A",
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      fees: [
        {
          id: "fee1",
          sessionClassId: "sc1",
          workspaceSubdomain: "test-madrasa",
          feeType: "tuition",
          amount: "100.00",
          createdAt: new Date().toISOString(),
        },
      ],
      schedules: [],
      budgets: [],
      discounts: [],
      timetables: [],
      refreshments: [],
      scholarships: [],
    };

    const tx = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            sessionId: "s1",
            faculty: [mockFacultyRow],
            classes: [mockClassRow],
          },
        ],
      }),
    } as any;

    const result = await hydrateSessionsListAggregated(tx, "test-madrasa", [mockSessionRow as any]);

    expect(tx.execute).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
    expect(result[0].name).toBe("Spring 2026");
    expect(result[0].classes).toHaveLength(1);
    expect(result[0].classes[0].name).toBe("Tajweed 101");
  });
});
