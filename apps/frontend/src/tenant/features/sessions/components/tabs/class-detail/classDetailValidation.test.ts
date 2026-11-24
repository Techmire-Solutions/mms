import { describe, expect, it } from "vitest";
import { ClassInsertSchema, ClassSchema } from "@mms/contracts";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { validateClassDraft } from "./classDetailValidation";

const t = ((key: string) => key) as unknown as TranslationFunction;
const validClass = () =>
  ClassSchema.parse({
    id: "c1",
    name: "Class A",
    maxStudents: 20,
    enrolled: 0,
    minAge: 10,
    maxAge: 20,
    fees: [{ id: "f1", feeType: "monthly", amount: "100" }],
  });

describe("validateClassDraft", () => {
  it("accepts a valid class", () => {
    expect(validateClassDraft(validClass(), t).errors).toEqual({});
  });

  it("maps structural errors to their tabs", () => {
    const invalid = {
      ...validClass(),
      name: "",
      minAge: 20,
      maxAge: 10,
      schedules: [{ id: "s1", startDate: "2026-02-01", endDate: "2026-01-01" }],
      fees: [{ id: "f1", feeType: "monthly", amount: "0" }],
    };
    const result = validateClassDraft(invalid as never, t);
    expect(result.errors.name).toBe("common.formPleaseFixErrors");
    expect(result.errors.maxAge).toBe("common.formPleaseFixErrors");
    expect(result.errors["fee.f1.amount"]).toBe("common.formPleaseFixErrors");
    expect(result.errors["schedule.s1.endDate"]).toBe("common.formPleaseFixErrors");
    // The first tab owning an error in navigation order wins, so the user lands on `general`.
    expect(result.tab).toBe("general");
  });

  it("rejects empty, duplicate, and invalid sections", () => {
    const invalid = {
      ...validClass(),
      sections: [
        { id: "sec-a", name: "A", capacity: 30, room: "", status: "active" },
        { id: "sec-b", name: "a", capacity: -1, room: "x".repeat(101), status: "active" },
      ],
    };
    const result = validateClassDraft(invalid as never, t);
    expect(result.errors["section.sec-b.name"]).toBe("common.formPleaseFixErrors");
    expect(result.errors["section.sec-b.capacity"]).toBe("common.formPleaseFixErrors");
    expect(result.errors["section.sec-b.room"]).toBe("common.formPleaseFixErrors");
    expect(result.tab).toBe("sections");
  });

  it("rejects invalid timetable periods", () => {
    const invalid = {
      ...validClass(),
      timetables: [
        {
          id: "tt1",
          date: "2026-01-01",
          periods: [{ id: "p1", startTime: "10:00", endTime: "09:00", subject: "Fiqh" }],
        },
      ],
    };
    expect(validateClassDraft(invalid as never, t).errors["period.p1.time"]).toBe(
      "common.formPleaseFixErrors",
    );
  });

  it("keeps schema-owned bounds in parity with ClassInsertSchema", () => {
    const cases = [
      {
        draft: { ...validClass(), sections: [{ id: "sec-x", name: "A", capacity: -1 }] },
        key: "section.sec-x.capacity",
      },
      {
        draft: {
          ...validClass(),
          discounts: [{ id: "d-x", discountType: "sibling", percentage: 101 }],
        },
        key: "discount.d-x.percentage",
      },
      {
        draft: { ...validClass(), scholarships: [{ id: "sch-x", percentage: -5 }] },
        key: "scholarshipPercentage",
      },
      {
        draft: {
          ...validClass(),
          refreshments: [{ id: "r-x", date: "2026-01-01", item: "Tea", quantity: -1 }],
        },
        key: "refreshment.r-x.amount",
      },
    ];
    for (const { draft, key } of cases) {
      expect(ClassInsertSchema.safeParse(draft).success, key).toBe(false);
      expect(validateClassDraft(draft as never, t).errors[key], key).toBe(
        "common.formPleaseFixErrors",
      );
    }
  });
});
