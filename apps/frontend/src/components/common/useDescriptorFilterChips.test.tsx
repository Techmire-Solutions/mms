import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import { useDescriptorFilterChips } from "./useDescriptorFilterChips";
import type { EntityDescriptor, FieldDefinition } from "@/types/entityRegistry";
import { ENTITY_REGISTRY } from "@/components/common/entityRegistry";

const MOCK_FIELDS: FieldDefinition<Record<string, unknown>>[] = [
  {
    key: "status",
    label: "Status",
    type: "status",
    badgeVariantMap: {
      active: { label: "Active", tone: "success" },
      archived: { label: "Archived", tone: "muted" },
    },
  },
  {
    key: "category",
    label: "Category",
    type: "badge",
    badgeVariantMap: {
      primary: { label: "Primary", tone: "primary" },
      secondary: { label: "Secondary", tone: "secondary" },
    },
  },
  {
    key: "name",
    label: "Name",
    type: "text",
    // no badgeVariantMap — must NOT generate a chip
  },
];

function makeMockDescriptor(): EntityDescriptor<Record<string, unknown>> {
  return {
    entityType: "test",
    singularLabel: "Test Entity",
    pluralLabel: "Test Entities",
    idField: "id",
    titleField: "name",
    fields: MOCK_FIELDS,
    getField: (key) => MOCK_FIELDS.find((f) => f.key === key),
    getTableColumns: () => [],
    getCardFields: () => [],
    getDrawerSections: () => [],
    getRawValue: () => undefined,
    formatFieldValue: () => "",
    renderFieldValue: () => null,
  };
}

function renderHookInDom<R>(hookFn: () => R): { getResult: () => R; cleanup: () => void } {
  let result!: R;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Wrapper() {
    result = hookFn();
    return null;
  }

  act(() => {
    root.render(<Wrapper />);
  });

  return {
    getResult: () => result,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useDescriptorFilterChips", () => {
  it("returns an empty array when no filters are active", () => {
    const { getResult, cleanup } = renderHookInDom(() =>
      useDescriptorFilterChips(makeMockDescriptor(), {}, vi.fn()),
    );
    expect(getResult()).toHaveLength(0);
    cleanup();
  });

  it("generates one chip per active badge/status filter", () => {
    const { getResult, cleanup } = renderHookInDom(() =>
      useDescriptorFilterChips(
        makeMockDescriptor(),
        { status: "active", category: "primary" },
        vi.fn(),
      ),
    );
    expect(getResult()).toHaveLength(2);
    cleanup();
  });

  it("does NOT generate a chip for text-type fields", () => {
    const { getResult, cleanup } = renderHookInDom(() =>
      useDescriptorFilterChips(makeMockDescriptor(), { name: "Alice", status: "active" }, vi.fn()),
    );
    const chips = getResult();
    expect(chips).toHaveLength(1);
    expect(chips[0]?.key).toBe("status");
    cleanup();
  });

  it("uses badgeVariantMap label in chip label text", () => {
    const { getResult, cleanup } = renderHookInDom(() =>
      useDescriptorFilterChips(makeMockDescriptor(), { status: "active" }, vi.fn()),
    );
    expect(getResult()[0]?.label).toBe("Status: Active");
    cleanup();
  });

  it("skips null/undefined/empty-string filter values", () => {
    const { getResult, cleanup } = renderHookInDom(() =>
      useDescriptorFilterChips(
        makeMockDescriptor(),
        { status: null, category: undefined, name: "" },
        vi.fn(),
      ),
    );
    expect(getResult()).toHaveLength(0);
    cleanup();
  });

  it("calls onRemove with the field key when chip.onRemove is invoked", () => {
    const onRemove = vi.fn();
    const { getResult, cleanup } = renderHookInDom(() =>
      useDescriptorFilterChips(makeMockDescriptor(), { status: "archived" }, onRemove),
    );
    const chips = getResult();
    expect(chips).toHaveLength(1);
    chips[0]?.onRemove();
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledWith("status");
    cleanup();
  });

  it("emits one chip per array filter value and passes the value to onRemove", () => {
    const onRemove = vi.fn();
    const { getResult, cleanup } = renderHookInDom(() =>
      useDescriptorFilterChips(makeMockDescriptor(), { status: ["active", "archived"] }, onRemove),
    );
    const chips = getResult();
    expect(chips).toHaveLength(2);
    expect(chips[0]?.key).toBe("status:active");
    chips[1]?.onRemove();
    expect(onRemove).toHaveBeenCalledWith("status", "archived");
    cleanup();
  });

  it("respects explicit filterable text fields", () => {
    const descriptor = makeMockDescriptor();
    descriptor.fields = [
      ...descriptor.fields,
      { key: "specialization", label: "Specialization", type: "text", filterable: true },
    ];
    const { getResult, cleanup } = renderHookInDom(() =>
      useDescriptorFilterChips(descriptor, { specialization: "Tajweed" }, vi.fn()),
    );
    expect(getResult()).toHaveLength(1);
    expect(getResult()[0]?.label).toBe("Specialization: Tajweed");
    cleanup();
  });

  it("returns empty array when descriptor is undefined", () => {
    const { getResult, cleanup } = renderHookInDom(() =>
      useDescriptorFilterChips(undefined, { status: "active" }, vi.fn()),
    );
    expect(getResult()).toHaveLength(0);
    cleanup();
  });

  describe("questionBank entity descriptor integration (G5)", () => {
    it("generates chips for badge-typed fields in the registered questionBank descriptor", () => {
      const descriptor = ENTITY_REGISTRY["questionBank"];
      expect(descriptor, "questionBank must be registered in ENTITY_REGISTRY").toBeDefined();

      // Identify the first badge/status field with a badgeVariantMap so we can activate a filter.
      const badgeField = descriptor.fields.find(
        (f) =>
          (f.type === "badge" || f.type === "status") &&
          f.badgeVariantMap &&
          Object.keys(f.badgeVariantMap).length > 0,
      );
      expect(
        badgeField,
        "questionBank descriptor must have at least one badge/status field",
      ).toBeDefined();

      const firstVariant = Object.keys(badgeField!.badgeVariantMap!)[0]!;
      const activeFilters: Record<string, string> = { [badgeField!.key]: firstVariant };

      const { getResult, cleanup } = renderHookInDom(() =>
        useDescriptorFilterChips(descriptor, activeFilters, vi.fn()),
      );

      const chips = getResult();
      expect(chips.length).toBeGreaterThanOrEqual(1);
      expect(chips.some((c) => c.key === badgeField!.key)).toBe(true);
      cleanup();
    });

    it("generates no chips for questionBank when no filters are active", () => {
      const descriptor = ENTITY_REGISTRY["questionBank"];
      expect(descriptor).toBeDefined();

      const { getResult, cleanup } = renderHookInDom(() =>
        useDescriptorFilterChips(descriptor, {}, vi.fn()),
      );
      expect(getResult()).toHaveLength(0);
      cleanup();
    });
  });
});
