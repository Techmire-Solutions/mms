import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import type { EntityDescriptor } from "@/types/entityRegistry";
import type { PlatformSettings } from "@mms/shared";
import { usePlatformSettingsDescriptor } from "./usePlatformSettingsDescriptor";

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
  let hookResult!: EntityDescriptor<PlatformSettings>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = usePlatformSettingsDescriptor();
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

describe("usePlatformSettingsDescriptor", () => {
  it("returns a descriptor with i18n-resolved labels for all fields", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const descriptor = getResult();

    expect(descriptor.entityType).toBe("platformSettings");
    expect(descriptor.singularLabel).toBe("Platform Setting");

    const columns = descriptor.getTableColumns();
    expect(columns.length).toBeGreaterThan(0);

    const emailCol = columns.find((c) => c.id === "certbotEmail");
    expect(emailCol?.label).toBe("[platform.descriptor.settings.certbotEmail]");

    for (const col of columns) {
      expect(col.label).toMatch(/^\[/);
    }
    cleanup();
  });

  it("labelKey values map to platform.descriptor.settings.* namespace", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const fields = getResult().fields;

    const emailField = fields.find((f) => f.key === "certbotEmail");
    expect(emailField?.labelKey).toBe("platform.descriptor.settings.certbotEmail");

    const tlsField = fields.find((f) => f.key === "syncTlsOnCreate");
    expect(tlsField?.labelKey).toBe("platform.descriptor.settings.syncTlsOnCreate");
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
