import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { FieldDefinition } from "@mms/contracts";
import { RegistryCustomFieldsGrid } from "@mms/fe-core/components/RegistryCustomFieldsGrid";

const base = { enabled: true, order: 1 } as const;
const fields: FieldDefinition[] = [
  { ...base, key: "nickname", label: "Nickname", type: "text", required: true },
  { ...base, key: "score", label: "Score", type: "number", order: 2 },
  { ...base, key: "grade", label: "Grade", type: "select", options: ["A", "B"], order: 3 },
  {
    ...base,
    key: "topics",
    label: "Topics",
    type: "multi_select",
    options: ["One", "Two"],
    order: 4,
  },
  { ...base, key: "active", label: "Active", type: "boolean", order: 5 },
];

describe("RegistryCustomFieldsGrid", () => {
  it("renders a control per enabled field and reports changes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <RegistryCustomFieldsGrid
          fields={fields}
          values={{ nickname: "Ali", score: "5", grade: "A", topics: ["One"], active: true }}
          errors={{ nickname: "Required" }}
          onChange={onChange}
        />,
      );
    });

    expect(container.querySelector("#registry-field-nickname")).toBeInstanceOf(HTMLInputElement);
    expect(container.querySelector("#registry-field-score")).toBeInstanceOf(HTMLInputElement);
    expect(container.querySelector("#registry-field-grade")).toBeInstanceOf(HTMLSelectElement);
    expect(container.textContent).toContain("Required");

    const grade = container.querySelector("#registry-field-grade") as HTMLElement;
    await act(async () => {
      grade.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });

  it("skips disabled fields", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <RegistryCustomFieldsGrid
          fields={[{ ...fields[0], enabled: false }]}
          values={{}}
          onChange={() => {}}
        />,
      );
    });

    expect(container.querySelector("#registry-field-nickname")).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });
});
