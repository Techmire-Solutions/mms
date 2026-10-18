import { describe, expect, it } from "vitest";
import { SessionSchema, type RegistrationLink } from "@mms/shared";
import {
  acceptsSubmissions,
  linkClasses,
  toPublicView,
} from "../enrollments/use-cases/registrationPublicView.js";

const session = SessionSchema.parse({
  id: "s1",
  name: "Hifz 2027",
  status: "open",
  startDate: "2027-04-01",
  classes: [
    {
      id: "c1",
      name: "Darja 1",
      gender: "male",
      minAge: 6,
      maxAge: 10,
      sections: [{ id: "a", name: "A", capacity: 2, enrolled: 2 }],
    },
    { id: "c2", name: "Darja 2", gender: "female", maxStudents: 0 },
  ],
});

function link(overrides: Partial<RegistrationLink> = {}): RegistrationLink {
  return {
    id: "l1",
    sessionId: "s1",
    slug: "slug-123456789",
    title: null,
    isActive: true,
    opensAt: null,
    closesAt: null,
    maxSubmissions: null,
    requiresReview: true,
    classIds: [],
    submissionCount: 0,
    deletedAt: null,
    createdAt: "2027-01-01T00:00:00.000Z",
    updatedAt: "2027-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const NOW = new Date("2027-02-01T10:00:00Z");

describe("registrationPublicView", () => {
  it("given a link without explicit classes, should offer every class with seat counts and no PII", () => {
    // Act
    const view = toPublicView(link(), session, "Madrasa", NOW);

    // Assert
    expect(view).toEqual({
      slug: "slug-123456789",
      title: "Hifz 2027",
      madrasaName: "Madrasa",
      sessionName: "Hifz 2027",
      startDate: "2027-04-01",
      endDate: "",
      closesAt: null,
      acceptingSubmissions: true,
      classes: [
        {
          id: "c1",
          name: "Darja 1",
          gender: "male",
          minAge: 6,
          maxAge: 10,
          ageCalculationDate: "2027-04-01",
          seatsLeft: 0,
        },
        {
          id: "c2",
          name: "Darja 2",
          gender: "female",
          minAge: 0,
          maxAge: 0,
          ageCalculationDate: "2027-04-01",
          seatsLeft: null,
        },
      ],
    });
  });

  it("given paused, closed-window, capped or draft-session links, should stop accepting submissions", () => {
    // Assert
    expect(linkClasses(link({ classIds: ["c2"] }), session).map((cls) => cls.id)).toEqual(["c2"]);
    expect(acceptsSubmissions(link({ isActive: false }), session, NOW)).toBe(false);
    expect(acceptsSubmissions(link({ closesAt: "2027-01-31T23:59:59.000Z" }), session, NOW)).toBe(
      false,
    );
    expect(acceptsSubmissions(link({ opensAt: "2027-03-01T00:00:00.000Z" }), session, NOW)).toBe(
      false,
    );
    expect(acceptsSubmissions(link({ maxSubmissions: 3, submissionCount: 3 }), session, NOW)).toBe(
      false,
    );
    expect(acceptsSubmissions(link(), { ...session, status: "draft" }, NOW)).toBe(false);
  });
});
