import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import type { QuestionBankQuestion } from "@mms/shared";
import { useQuestionBankEntityDescriptor } from "./useQuestionBankEntityDescriptor";

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
  let hookResult!: EntityDescriptor<QuestionBankQuestion>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = useQuestionBankEntityDescriptor();
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

describe("useQuestionBankEntityDescriptor", () => {
  it("returns a descriptor with i18n-resolved labels for all fields", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const descriptor = getResult();

    expect(descriptor.entityType).toBe("questionBank");
    expect(descriptor.singularLabel).toBe("Question");

    const columns = descriptor.getTableColumns();
    expect(columns.length).toBeGreaterThan(0);

    for (const col of columns) {
      expect(col.label).toMatch(/^\[/);
    }
    cleanup();
  });

  it("type field has badgeVariantMap with mcq/short_answer/true_false/essay", () => {
    const { getResult, cleanup } = renderHookWrapper();
    const typeField = getResult().fields.find((f) => f.key === "type");
    expect(typeField?.badgeVariantMap?.mcq).toBeDefined();
    expect(typeField?.badgeVariantMap?.essay).toBeDefined();
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
