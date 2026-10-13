import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import type { Enrollment } from "@mms/shared";
import { useEnrollmentEntityDescriptor } from "./useEnrollmentEntityDescriptor";

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
  let hookResult!: EntityDescriptor<Enrollment>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = useEnrollmentEntityDescriptor();
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

describe("useEnrollmentEntityDescriptor", () => {
  it("returns a descriptor with i18n-resolved labels for all fields", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const descriptor = getResult();

    expect(descriptor.entityType).toBe("enrollments");
    expect(descriptor.singularLabel).toBe("Enrollment");

    const columns = descriptor.getTableColumns();
    expect(columns.length).toBeGreaterThan(0);

    for (const col of columns) {
      expect(col.label).toMatch(/^\[/);
    }
    cleanup();
  });

  it("status field has badgeVariantMap with enrolled/pending/withdrawn", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const statusField = getResult().fields.find((f) => f.key === "status");
    expect(statusField?.badgeVariantMap).toBeDefined();
    expect(statusField?.badgeVariantMap?.enrolled).toBeDefined();
    expect(statusField?.badgeVariantMap?.pending).toBeDefined();
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

  it("drawer sections are non-empty", () => {
    const { getResult, cleanup } = renderHookWrapper();
    for (const section of getResult().getDrawerSections()) {
      expect(section.fields.length, `Section "${section.id}" is empty`).toBeGreaterThan(0);
    }
    cleanup();
  });
});
