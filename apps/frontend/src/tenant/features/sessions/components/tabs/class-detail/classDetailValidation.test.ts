import { describe, expect, it } from "vitest";
import { ClassSchema } from "@mms/shared";
import { validateClassDraft } from "./classDetailValidation";

const t = (key: string) => key;
const validClass = () =>
  ClassSchema.parse({
    id: "c1",
    name: "Class A",
    maxStudents: 20,
    enrolled: 0,
    minAge: 10,
    maxAge: 20,
    fees: [{ id: "f1", feeType: "monthly", amount: 100 }],
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
      fees: [{ id: "f1", feeType: "monthly", amount: 0 }],
    };
    const result = validateClassDraft(invalid as never, t);
    expect(result.errors.name).toBe("common.formPleaseFixErrors");
    expect(result.errors.maxAge).toBe("common.formPleaseFixErrors");
    expect(result.errors["fee.f1.amount"]).toBe("common.formPleaseFixErrors");
    expect(result.errors["schedule.s1.endDate"]).toBe("common.formPleaseFixErrors");
    expect(result.tab).toBe("fees");
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
});
