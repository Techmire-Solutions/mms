import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { User } from "lucide-react";
import { ContactProfileValue, resolveStudentFieldLabel } from "./StudentFormSectionShared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("StudentFormSectionShared", () => {
  it("resolves student field label from fields map or fallback", () => {
    const fields = {
      basic: [
        { key: "dob", label: "Date of Birth", type: "date" as const, enabled: true, order: 0 },
      ],
    };
    const t = (key: string) => key;

    expect(
      resolveStudentFieldLabel(fields, "basic", "dob", "students.form.fieldDob", t as never),
    ).toBe("Date of Birth");

    expect(
      resolveStudentFieldLabel(fields, "basic", "unknown", "students.form.fieldDob", t as never),
    ).toBe("students.form.fieldDob");
  });

  it("renders ContactProfileValue with value or notSetOnContact fallback", () => {
    const htmlWithValue = renderToStaticMarkup(
      <ContactProfileValue label="Gender" value="Male" icon={User} />,
    );
    expect(htmlWithValue).toContain("Gender");
    expect(htmlWithValue).toContain("Male");

    const htmlEmpty = renderToStaticMarkup(
      <ContactProfileValue label="Gender" value="" icon={User} />,
    );
    expect(htmlEmpty).toContain("students.form.notSetOnContact");
  });
});
