import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import type { PlatformWorkspaceRow } from "@mms/shared";
import { usePlatformWorkspaceDescriptor } from "./usePlatformWorkspaceDescriptor";

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
  let hookResult!: EntityDescriptor<PlatformWorkspaceRow>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = usePlatformWorkspaceDescriptor();
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

describe("usePlatformWorkspaceDescriptor", () => {
  it("returns a descriptor with i18n-resolved labels for all fields", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const descriptor = getResult();

    expect(descriptor.entityType).toBe("platformWorkspaces");
    expect(descriptor.singularLabel).toBe("Workspace");

    const columns = descriptor.getTableColumns();
    expect(columns.length).toBeGreaterThan(0);

    const nameCol = columns.find((c) => c.id === "madrasaName");
    expect(nameCol?.label).toBe("[platform.descriptor.workspace.madrasaName]");

    for (const col of columns) {
      expect(col.label).toMatch(/^\[/);
    }
    cleanup();
  });

  it("labelKey values map to platform.descriptor.workspace.* namespace", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const fields = getResult().fields;

    const nameField = fields.find((f) => f.key === "madrasaName");
    expect(nameField?.labelKey).toBe("platform.descriptor.workspace.madrasaName");

    const subdomainField = fields.find((f) => f.key === "subdomain");
    expect(subdomainField?.labelKey).toBe("platform.descriptor.workspace.subdomain");
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
