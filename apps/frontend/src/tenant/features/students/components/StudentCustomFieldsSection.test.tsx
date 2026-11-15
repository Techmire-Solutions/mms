import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { FieldDefinition, Student } from "@mms/shared";
import { StudentCustomFieldsSection } from "./StudentCustomFieldsSection";

const fields: FieldDefinition[] = [
  {
    key: "house",
    label: "House",
    type: "text",
    enabled: true,
    order: 1,
    required: true,
  },
];

describe("StudentCustomFieldsSection", () => {
  it("renders enabled custom fields and patches the student draft", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onDraftChange = vi.fn();

    await act(async () => {
      root.render(
        <StudentCustomFieldsSection
          fields={{ registration: fields }}
          draft={{ house: "Red" } as Partial<Student>}
          getFieldError={(key) => (key === "house" ? "Required" : undefined)}
          onDraftChange={onDraftChange}
        />,
      );
    });

    expect(container.textContent).toContain("Required");
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("Red");

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "Blue");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onDraftChange).toHaveBeenCalledWith({ house: "Blue" });

    await act(async () => root.unmount());
    container.remove();
  });
});
