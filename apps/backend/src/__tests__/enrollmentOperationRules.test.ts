import { describe, expect, it } from "vitest";
import { SessionSchema, type EnrollmentPlacement } from "@mms/shared";
import {
  findTransferTarget,
  operationWindowError,
} from "../enrollments/use-cases/enrollmentOperationRules.js";

const session = SessionSchema.parse({
  id: "s1",
  name: "Hifz 2026",
  status: "in_progress",
  classes: [
    {
      id: "c1",
      name: "Darja 1",
      sections: [
        { id: "a", name: "A", capacity: 2, enrolled: 2 },
        { id: "b", name: "B", capacity: 3, enrolled: 1 },
      ],
    },
    { id: "c2", name: "Darja 2", maxStudents: 0 },
    {
      id: "c3",
      name: "Darja 3",
      sections: [{ id: "x", name: "X", capacity: 1, enrolled: 0, status: "closed" }],
    },
  ],
});

const enrollment = { classId: "c1", sectionId: "a" };
const placement = (overrides: Partial<EnrollmentPlacement> = {}): EnrollmentPlacement => ({
  id: "p1",
  enrollmentId: "e1",
  classId: "c1",
  sectionId: "a",
  startOn: "2026-02-01",
  endOn: null,
  reason: null,
  ...overrides,
});

describe("findTransferTarget", () => {
  it("given another section of the same class, should resolve it with its free seats", () => {
    // Act
    const target = findTransferTarget(session, enrollment, "c1", "b");

    // Assert
    expect(target).toMatchObject({ sectionId: "b", seatsLeft: 2 });
  });

  it("given a class without sections or cap, should allow it with unlimited seats", () => {
    // Act
    const target = findTransferTarget(session, enrollment, "c2", null);

    // Assert
    expect(target).toMatchObject({ sectionId: null, seatsLeft: null });
  });

  it("given the current placement, a foreign class or a closed section, should explain why", () => {
    // Assert
    expect(findTransferTarget(session, enrollment, "c1", "a")).toEqual({
      error: "The student is already in this class and section",
    });
    expect(findTransferTarget(session, enrollment, "other", null)).toEqual({
      error: "The class is not part of this enrollment's session",
    });
    expect(findTransferTarget(session, enrollment, "c3", "x")).toEqual({
      error: "The section is not an active section of the class",
    });
  });
});

describe("operationWindowError", () => {
  const dated = { startOn: null, enrolledDate: "2026-01-10" };

  it("given a date between the placement start and today, should allow it", () => {
    // Assert
    expect(operationWindowError(dated, [placement()], "2026-02-01", "2026-03-01")).toBeNull();
  });

  it("given a future date or one before the current placement began, should reject it", () => {
    // Assert
    expect(operationWindowError(dated, [placement()], "2026-03-02", "2026-03-01")).toBe(
      "The effective date cannot be in the future",
    );
    expect(operationWindowError(dated, [placement()], "2026-01-31", "2026-03-01")).toBe(
      "The effective date must be on or after 2026-02-01, when the current placement began",
    );
  });

  it("given no placement history, should fall back to the enrollment date", () => {
    // Assert
    expect(operationWindowError(dated, [], "2026-01-09", "2026-03-01")).toBe(
      "The effective date must be on or after 2026-01-10, when the current placement began",
    );
  });
});
