import { describe, expect, it } from "vitest";
import { getQuickActionsForRole } from "./dashboardQuickActions";

describe("dashboardQuickActions", () => {
  it("returns quick actions configured for admin role", () => {
    const adminActions = getQuickActionsForRole("admin");
    expect(adminActions.length).toBeGreaterThan(0);
    expect(adminActions.every((action) => action.roles.includes("admin"))).toBe(true);
  });

  it("returns quick actions configured for accountant role", () => {
    const accountantActions = getQuickActionsForRole("accountant");
    expect(accountantActions.some((action) => action.id === "record-payment")).toBe(true);
    expect(accountantActions.some((action) => action.id === "print-receipt")).toBe(true);
  });

  it("returns quick actions configured for faculty role", () => {
    const facultyActions = getQuickActionsForRole("faculty");
    expect(facultyActions.length).toBeGreaterThan(0);
    expect(facultyActions.every((action) => action.roles.includes("faculty"))).toBe(true);
    expect(facultyActions.some((action) => action.id === "take-attendance")).toBe(true);
    expect(facultyActions.some((action) => action.id === "print-receipt")).toBe(false);
  });

  it("returns empty list for unknown role", () => {
    const unknownActions = getQuickActionsForRole("unknown");
    expect(unknownActions).toHaveLength(0);
  });
});
