import { describe, expect, it } from "vitest";
import {
  assertCapacityAboveActive,
  assertCertificatesIssuable,
  assertParticipantWithdrawable,
  assertWorkshopActivityEditable,
  assertWorkshopDates,
  assertWorkshopMutable,
  assertWorkshopNotArchived,
  assertWorkshopRegistrable,
  assertWorkshopTransitionAllowed,
} from "../workshops/domain/workshopWriteGuards.js";
import { ConflictError, HttpDomainError, NotFoundError } from "../lib/httpErrors.js";

const workshop = {
  id: "ws-1",
  status: "open",
  startDate: "2099-03-01",
  endDate: "2099-03-02",
  registrationDeadline: null,
  capacity: null,
  deletedAt: null,
};

const today = "2026-03-10";

describe("workshop write guards", () => {
  it("treats an archived workshop as not found", () => {
    expect(() => assertWorkshopNotArchived({ id: "ws-1", deletedAt: new Date() })).toThrowError(
      NotFoundError,
    );
  });

  it("closes structural edits on completed and cancelled workshops", () => {
    for (const status of ["completed", "cancelled"]) {
      expect(() => assertWorkshopMutable({ ...workshop, status })).toThrowError(ConflictError);
      try {
        assertWorkshopMutable({ ...workshop, status });
      } catch (error) {
        expect((error as ConflictError).type).toBe("workshop_read_only");
      }
    }
    expect(() => assertWorkshopMutable(workshop)).not.toThrow();
    expect(() => assertWorkshopMutable({ ...workshop, status: "draft" })).not.toThrow();
  });

  it("rejects invalid date combinations with a typed 400", () => {
    expect(() =>
      assertWorkshopDates({ startDate: "2026-03-05", endDate: "2026-03-01" }),
    ).toThrowError(HttpDomainError);
    try {
      assertWorkshopDates({
        startDate: "2026-03-01",
        endDate: "2026-03-02",
        registrationDeadline: "2026-03-09",
      });
    } catch (error) {
      expect((error as HttpDomainError).statusCode).toBe(400);
      expect((error as HttpDomainError).type).toBe("invalid_workshop_dates");
    }
    expect(() =>
      assertWorkshopDates({ startDate: "2026-03-01", endDate: "2026-03-02" }),
    ).not.toThrow();
  });

  it("maps each registration blocker to a typed conflict", () => {
    expect(() =>
      assertWorkshopRegistrable({ ...workshop, status: "draft" }, { today, seatsTaken: 0 }),
    ).toThrowError(ConflictError);
    for (const [input, expected] of [
      [{ ...workshop, registrationDeadline: "2026-03-09" }, "deadline_passed"],
      [{ ...workshop, startDate: "2026-03-01", endDate: "2026-03-02" }, "workshop_ended"],
      [{ ...workshop, capacity: 2 }, "capacity_full"],
    ] as const) {
      try {
        assertWorkshopRegistrable(input, { today, seatsTaken: 2 });
        throw new Error("expected a conflict");
      } catch (error) {
        expect((error as ConflictError).type).toBe(expected);
      }
    }
    expect(() => assertWorkshopRegistrable(workshop, { today, seatsTaken: 0 })).not.toThrow();
  });

  it("blocks check-ins on drafts and cancelled workshops but allows completion corrections", () => {
    for (const status of ["draft", "cancelled"]) {
      expect(() => assertWorkshopActivityEditable({ ...workshop, status })).toThrowError(
        ConflictError,
      );
    }
    expect(() =>
      assertWorkshopActivityEditable({ ...workshop, status: "completed" }),
    ).not.toThrow();
    expect(() => assertWorkshopActivityEditable(workshop)).not.toThrow();
  });

  it("refuses to withdraw a certified participant or touch a cancelled workshop", () => {
    try {
      assertParticipantWithdrawable(workshop, { id: "p1", certificateIssuedAt: new Date() });
      throw new Error("expected a conflict");
    } catch (error) {
      expect((error as ConflictError).type).toBe("certificate_issued");
    }
    expect(() =>
      assertParticipantWithdrawable(
        { ...workshop, status: "cancelled" },
        { id: "p1", certificateIssuedAt: null },
      ),
    ).toThrowError(ConflictError);
    expect(() =>
      assertParticipantWithdrawable(workshop, { id: "p1", certificateIssuedAt: null }),
    ).not.toThrow();
  });

  it("issues certificates only after the workshop finished or was completed", () => {
    try {
      assertCertificatesIssuable({ ...workshop, startDate: "2099-03-01" }, { today });
      throw new Error("expected a conflict");
    } catch (error) {
      expect((error as ConflictError).type).toBe("workshop_not_finished");
    }
    expect(() =>
      assertCertificatesIssuable({ ...workshop, status: "cancelled" }, { today }),
    ).toThrowError(ConflictError);
    expect(() =>
      assertCertificatesIssuable(
        { ...workshop, startDate: "2000-01-01", endDate: "2000-01-02" },
        { today },
      ),
    ).not.toThrow();
    expect(() =>
      assertCertificatesIssuable(
        { ...workshop, status: "completed", startDate: "2099-03-01" },
        { today },
      ),
    ).not.toThrow();
  });

  it("maps each transition violation to a typed conflict", () => {
    const cases: Array<[Parameters<typeof assertWorkshopTransitionAllowed>[0], string, string]> = [
      [{ ...workshop, status: "completed" }, "open", "illegal_workshop_transition"],
      [{ ...workshop, status: "open" }, "draft", "workshop_has_registrations"],
      [
        { ...workshop, status: "open", startDate: null, endDate: null },
        "completed",
        "end_date_required",
      ],
      [{ ...workshop, status: "open" }, "completed", "completion_before_end_date"],
      [{ ...workshop, status: "open" }, "cancelled", "certificates_issued"],
    ];
    const context = { today, liveRegistrations: 2, certificatesIssued: 1 };
    for (const [state, target, expected] of cases) {
      try {
        assertWorkshopTransitionAllowed(state, target, context);
        throw new Error(`expected a conflict for ${target}`);
      } catch (error) {
        expect((error as ConflictError).type).toBe(expected);
      }
    }
  });

  it("allows the legal transitions", () => {
    expect(() =>
      assertWorkshopTransitionAllowed({ ...workshop, status: "draft" }, "open", { today }),
    ).not.toThrow();
    expect(() =>
      assertWorkshopTransitionAllowed(
        { ...workshop, status: "open", startDate: "2000-01-01", endDate: "2000-01-02" },
        "completed",
        { today },
      ),
    ).not.toThrow();
    expect(() =>
      assertWorkshopTransitionAllowed({ ...workshop, status: "open" }, "cancelled", { today }),
    ).not.toThrow();
  });

  it("keeps capacity at or above the seats already sold", () => {
    expect(() => assertCapacityAboveActive(1, 2)).toThrowError(ConflictError);
    expect(() => assertCapacityAboveActive(2, 2)).not.toThrow();
    expect(() => assertCapacityAboveActive(null, 99)).not.toThrow();
    expect(() => assertCapacityAboveActive(undefined, 99)).not.toThrow();
  });
});
