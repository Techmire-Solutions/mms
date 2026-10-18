import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import type { PlatformUserProfile } from "@mms/shared";
import { usePlatformUserDescriptor } from "./usePlatformUserDescriptor";

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
  let hookResult!: EntityDescriptor<PlatformUserProfile>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = usePlatformUserDescriptor();
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

describe("usePlatformUserDescriptor", () => {
  it("returns a descriptor with i18n-resolved labels for all fields", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const descriptor = getResult();

    expect(descriptor.entityType).toBe("platformUsers");
    expect(descriptor.singularLabel).toBe("Platform Admin");

    const columns = descriptor.getTableColumns();
    expect(columns.length).toBeGreaterThan(0);

    const nameCol = columns.find((c) => c.id === "name");
    expect(nameCol?.label).toBe("[platform.descriptor.user.name]");

    for (const col of columns) {
      expect(col.label).toMatch(/^\[/);
    }
    cleanup();
  });

  it("labelKey values map to platform.descriptor.user.* namespace", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const fields = getResult().fields;

    const nameField = fields.find((f) => f.key === "name");
    expect(nameField?.labelKey).toBe("platform.descriptor.user.name");

    const roleField = fields.find((f) => f.key === "role");
    expect(roleField?.labelKey).toBe("platform.descriptor.user.role");
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
