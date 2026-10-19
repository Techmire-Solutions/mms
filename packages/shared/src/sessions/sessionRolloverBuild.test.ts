import { describe, expect, it } from "vitest";
import { buildRolloverSession, isoDayOffset } from "./sessionRolloverBuild.js";
import { SessionSchema } from "./sessionTypes.js";

const source = SessionSchema.parse({
  id: "s1",
  name: "2025-26",
  status: "completed",
  startDate: "2025-04-01",
  endDate: "2026-03-31",
  workingDays: ["monday", "tuesday"],
  baseFee: 1000,
  faculty: [{ id: "f1", sessionId: "s1", facultyId: "t1", role: "coordinator" }],
  classes: [
    {
      id: "c1",
      name: "Hifz 1",
      enrolled: 12,
      enrollmentDeadline: "2025-04-15",
      sections: [
        { id: "a", name: "A", capacity: 20, status: "active", enrolled: 12 },
        { id: "b", name: "B", capacity: 20, status: "closed" },
      ],
      fees: [{ id: "fee", feeType: "monthly", amount: 500 }],
      discounts: [
        { id: "d", discountType: "sibling", percentage: 10, startDate: "2025-04-01", endDate: "" },
      ],
      scholarships: [{ id: "sch", percentage: 50, expiryDate: "2026-03-31" }],
      timetables: [{ id: "tt", date: "2025-04-02", periods: [] }],
    },
  ],
});

const target = { name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31" };

function sequentialIds() {
  let next = 0;
  return () => `n${++next}`;
}

describe("isoDayOffset", () => {
  it("given two dates, should count whole calendar days between them", () => {
    expect(isoDayOffset("2025-04-01", "2026-04-01")).toBe(365);
    expect(isoDayOffset("", "2026-04-01")).toBe(0);
  });
});

describe("buildRolloverSession", () => {
  it("given full copy flags, should copy structure with new ids and shifted dates", () => {
    // Act
    const { session, ids, offsetDays } = buildRolloverSession(
      source,
      {
        target,
        copy: {
          fees: true,
          discounts: true,
          scholarships: true,
          workingDays: true,
          staff: true,
          calendar: false,
        },
      },
      sequentialIds(),
    );

    // Assert
    const [cls] = session.classes;
    expect(offsetDays).toBe(365);
    expect(session).toMatchObject({ status: "draft", name: "2026-27", faculty: [] });
    expect(session.workingDays).toEqual(["monday", "tuesday"]);
    expect(cls).toMatchObject({
      sessionId: session.id,
      enrolled: 0,
      enrollmentDeadline: "2026-04-15",
    });
    expect(cls?.sections?.map((section) => section.name)).toEqual(["A"]);
    expect(ids.classIds.get("c1")).toBe(cls?.id);
    expect(ids.sectionIds.get("a")).toBe(cls?.sections?.[0]?.id);
    expect(cls?.fees[0]).toMatchObject({ classId: cls?.id, amount: 500 });
    expect(cls?.fees[0]?.id).not.toBe("fee");
    expect(cls?.discounts[0]).toMatchObject({ startDate: "2026-04-01", endDate: "" });
    expect(cls?.scholarships[0]?.expiryDate).toBe("2027-03-31");
    expect(cls?.timetables).toEqual([]);
  });

  it("given copy flags off, should leave fees, discounts, scholarships and working days out", () => {
    // Act
    const { session } = buildRolloverSession(
      source,
      {
        target,
        copy: {
          fees: false,
          discounts: false,
          scholarships: false,
          workingDays: false,
          staff: false,
          calendar: false,
        },
      },
      sequentialIds(),
    );

    // Assert
    const [cls] = session.classes;
    expect(session.workingDays).toBeUndefined();
    expect([cls?.fees, cls?.discounts, cls?.scholarships]).toEqual([[], [], []]);
  });
});
