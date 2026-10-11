import { describe, expect, it } from "vitest";
import {
  computeStudentsCommandMetrics,
  computeFacultyCommandMetrics,
  computeSessionsCommandMetrics,
  computeEnrollmentsCommandMetrics,
  computeUsersCommandMetrics,
} from "../moduleCommandMetrics.js";

describe("moduleCommandMetrics", () => {
  it("computes student metrics breakdown correctly", () => {
    const students = [
      { status: "active", registeredDate: new Date().toISOString() },
      { status: "active", registeredDate: "2020-01-01" },
      { status: "inactive" },
      { status: "suspended" },
    ];

    const metrics = computeStudentsCommandMetrics(students);
    expect(metrics.total).toBe(4);
    expect(metrics.active).toBe(2);
    expect(metrics.inactive).toBe(1);
    expect(metrics.suspended).toBe(1);
    expect(metrics.newThisPeriod).toBe(1);
  });

  it("computes faculty metrics breakdown correctly", () => {
    const faculty = [
      { status: "active", joinDate: new Date().toISOString() },
      { status: "on_leave", joinDate: "2021-05-10" },
      { status: "inactive" },
      { status: "sabbatical" },
    ];

    const metrics = computeFacultyCommandMetrics(faculty);
    expect(metrics.total).toBe(4);
    expect(metrics.active).toBe(1);
    expect(metrics.onLeave).toBe(1);
    expect(metrics.inactive).toBe(1);
    expect(metrics.other).toBe(1);
    expect(metrics.newThisPeriod).toBe(1);
  });

  it("computes sessions metrics and total capacity/enrollments", () => {
    const sessions = [
      {
        status: "active",
        startDate: new Date().toISOString(),
        classes: [
          { enrolled: 15, capacity: 20 },
          { enrolled: 10, capacity: 15 },
        ],
      },
      {
        status: "upcoming",
        classes: [{ enrolled: 5, capacity: 10 }],
      },
    ];

    const metrics = computeSessionsCommandMetrics(sessions);
    expect(metrics.total).toBe(2);
    expect(metrics.active).toBe(1);
    expect(metrics.upcoming).toBe(1);
    expect(metrics.totalEnrolled).toBe(30);
    expect(metrics.totalCapacity).toBe(45);
    expect(metrics.totalClasses).toBe(3);
  });

  it("computes enrollments metrics and total revenue", () => {
    const enrollments = [
      { status: "confirmed", finalFee: 1500, enrolledDate: new Date().toISOString() },
      { status: "confirmed", finalFee: 2000 },
      { status: "cancelled", finalFee: 1000 },
    ];

    const metrics = computeEnrollmentsCommandMetrics(enrollments);
    expect(metrics.total).toBe(3);
    expect(metrics.confirmed).toBe(2);
    expect(metrics.cancelled).toBe(1);
    expect(metrics.revenue).toBe(3500); // 1500 + 2000 (cancelled excluded)
    expect(metrics.newThisPeriod).toBe(1);
  });

  it("computes users metrics breakdown correctly", () => {
    const users = [
      { status: "active", role: "admin", twoFactorEnabled: true, activeSessions: 2 },
      { status: "active", role: "staff", twoFactorEnabled: false, activeSessions: 1 },
      { status: "suspended", role: "admin", twoFactorEnabled: true, activeSessions: 0 },
    ];

    const metrics = computeUsersCommandMetrics(users);
    expect(metrics.total).toBe(3);
    expect(metrics.active).toBe(2);
    expect(metrics.suspended).toBe(1);
    expect(metrics.admins).toBe(2);
    expect(metrics.twoFaEnabled).toBe(2);
    expect(metrics.activeSessions).toBe(3);
  });
});
