import { describe, expect, it } from "vitest";
import { resolveFacultyFieldLabel } from "./FacultyFormSectionShared";

describe("FacultyFormSectionShared", () => {
  it("resolves faculty field label from custom/tab fields or seed fields", () => {
    const fields = {
      employment: [
        {
          key: "specialization",
          label: "Specialization",
          type: "text" as const,
          enabled: true,
          order: 0,
        },
      ],
    };
    const t = (key: string) => key;

    expect(resolveFacultyFieldLabel(fields, "employment", "specialization", t as never)).toBe(
      "Specialization",
    );

    expect(resolveFacultyFieldLabel(fields, "employment", "employeeId", t as never)).toBe(
      "faculty.field.employeeId",
    );
  });
});
