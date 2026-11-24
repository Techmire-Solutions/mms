import { describe, expect, it } from "vitest";
import { isoUtcTimestampSchema } from "../core/isoDateSchema.js";
import {
  WORKSHOP_PARTICIPANT_STATUSES,
  workshopAttendanceRecordSchema,
  workshopEventRecordSchema,
  workshopParticipantRecordSchema,
} from "./workshopsRecords.js";
import { WORKSHOP_COMPLETION_STATUSES } from "./workshopCompletion.js";
import {
  resolveWorkshopRegistrationState,
  WORKSHOP_REGISTRATION_STATES,
} from "./workshopRegistrationState.js";

const event = {
  id: "w1",
  title: "Calligraphy",
  description: "",
  startDate: "2099-03-01",
  endDate: "2099-03-02",
  registrationDeadline: null,
  capacity: 20,
  fee: null,
  programId: null,
  subjectId: null,
  minAttendancePct: null,
  minScorePct: null,
  participantCount: 1,
  waitlistEnabled: false,
  status: "open" as const,
  phase: "registration_open" as const,
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
};

const participant = {
  id: "p1",
  workshopId: "w1",
  contactId: "c1",
  contactName: "Amina",
  contactPhone: "",
  status: "registered" as const,
  completedAt: null,
  certificateIssuedAt: null,
  waitlistedAt: null,
};

describe("workshop contract strictness", () => {
  it("rejects non-ISO UTC timestamps", () => {
    for (const value of [
      "2026-03-01",
      "2026-02-31T10:00:00.000Z",
      "2026-03-01T24:00:00.000Z",
      "2026-03-01T10:00:00+05:00",
      "2026-03-01T10:00:00",
    ]) {
      expect(isoUtcTimestampSchema.safeParse(value).success, value).toBe(false);
    }
    expect(isoUtcTimestampSchema.safeParse("2026-03-01T10:00:00.000Z").success).toBe(true);
  });

  it("validates record dates and timestamps instead of accepting arbitrary strings", () => {
    expect(workshopEventRecordSchema.safeParse(event).success).toBe(true);
    expect(workshopEventRecordSchema.safeParse({ ...event, startDate: "not-a-date" }).success).toBe(
      false,
    );
    expect(workshopEventRecordSchema.safeParse({ ...event, updatedAt: "yesterday" }).success).toBe(
      false,
    );

    expect(workshopParticipantRecordSchema.safeParse(participant).success).toBe(true);
    expect(
      workshopParticipantRecordSchema.safeParse({ ...participant, completedAt: "2026-03-02" })
        .success,
    ).toBe(false);

    expect(
      workshopAttendanceRecordSchema.safeParse({
        participantId: "p1",
        dayOn: "2099-03-01",
        status: "present",
      }).success,
    ).toBe(true);
    expect(
      workshopAttendanceRecordSchema.safeParse({
        participantId: "p1",
        dayOn: "03/01/2099",
        status: "present",
      }).success,
    ).toBe(false);
  });

  it("keeps completion statuses identical to participant statuses", () => {
    expect(new Set(WORKSHOP_COMPLETION_STATUSES)).toEqual(new Set(WORKSHOP_PARTICIPANT_STATUSES));
  });
});

describe("derived workshop registration state", () => {
  it("maps the six product states with the documented precedence", () => {
    const base = { participantStatus: "registered" as const, waitlistedAt: null };
    expect(resolveWorkshopRegistrationState({ ...base, workshopStatus: "open" })).toBe(
      "registered",
    );
    expect(
      resolveWorkshopRegistrationState({
        ...base,
        waitlistedAt: "2026-03-01T10:00:00.000Z",
        workshopStatus: "open",
      }),
    ).toBe("waitlisted");
    expect(
      resolveWorkshopRegistrationState({
        ...base,
        participantStatus: "attended",
        workshopStatus: "open",
      }),
    ).toBe("attended");
    expect(
      resolveWorkshopRegistrationState({
        ...base,
        participantStatus: "completed",
        workshopStatus: "completed",
      }),
    ).toBe("completed");
    expect(resolveWorkshopRegistrationState({ ...base, workshopStatus: "completed" })).toBe(
      "no_show",
    );
    expect(resolveWorkshopRegistrationState({ ...base, workshopStatus: "cancelled" })).toBe(
      "cancelled",
    );
    expect(
      resolveWorkshopRegistrationState({
        ...base,
        workshopStatus: "open",
        workshopDeletedAt: "2026-03-02T10:00:00.000Z",
      }),
    ).toBe("cancelled");
    expect(WORKSHOP_REGISTRATION_STATES).toHaveLength(6);
  });
});
