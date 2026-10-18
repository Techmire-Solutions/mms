import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import type { Student } from "@mms/shared";
import { useStudentEntityDescriptor } from "./useStudentEntityDescriptor";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => `[${key}]`,
    dir: "ltr",
    language: "en",
    isLoading: false,
    isRtl: false,
  }),
}));

function renderHookWrapper() {
  let hookResult!: EntityDescriptor<Student>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = useStudentEntityDescriptor();
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    getResult: () => hookResult,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useStudentEntityDescriptor", () => {
  it("returns a descriptor with i18n-resolved labels for all fields", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const descriptor = getResult();

    expect(descriptor.entityType).toBe("students");
    expect(descriptor.singularLabel).toBe("Student");

    const columns = descriptor.getTableColumns();
    expect(columns.length).toBeGreaterThan(0);

    const nameCol = columns.find((c) => c.id === "name");
    expect(nameCol?.label).toBe("[students.columns.name]");

    for (const col of columns) {
      expect(col.label).toMatch(/^\[/);
    }
    cleanup();
  });

  it("labelKey values on static descriptor match existing translation keys", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const fields = getResult().fields;

    const nameField = fields.find((f) => f.key === "name");
    expect(nameField?.labelKey).toBe("students.columns.name");

    const grField = fields.find((f) => f.key === "grNumber");
    expect(grField?.labelKey).toBe("students.columns.grNumber");

    const statusField = fields.find((f) => f.key === "status");
    expect(statusField?.labelKey).toBe("students.columns.status");
    cleanup();
  });

  it("all fields carry a labelKey", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const fields = getResult().fields;
    for (const field of fields) {
      expect(field.labelKey, `Field "${field.key}" is missing labelKey`).toBeTruthy();
    }
    cleanup();
  });
});
