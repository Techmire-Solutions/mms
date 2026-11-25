import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FacultyFormDesignationSection } from "./FacultyFormDesignationSection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../hooks/useWorkspaceToday", () => ({
  useWorkspaceToday: () => "2026-01-15",
}));

vi.mock("./FacultyCatalogCreateOverlays", () => ({
  FacultyCatalogCreateOverlays: () => null,
}));

vi.mock("../hooks/useWorkspaceRoles", () => ({
  useWorkspaceRoles: () => [
    {
      id: "instructor",
      labelKey: "users.role.instructor",
      customLabel: "Instructor",
      permissions: {},
      isSystem: true,
    },
  ],
}));

vi.mock("@mms/fe-core/components/FormSelect", () => ({
  FormSelect: ({ id, value }: { id?: string; value?: string }) => (
    <input data-testid={`status-select-${id ?? ""}`} value={value ?? ""} readOnly />
  ),
}));

const designationOptions = [
  {
    id: "des-1",
    departmentId: "dept-1",
    name: "Head of Department",
    status: "active" as const,
    hierarchyRank: 2,
    assignableRoles: [],
  },
];

/** Enable designation + status fields only (keeps DatePicker out of the render). */
const isFieldEnabled = (fieldId: string): boolean =>
  fieldId !== "designationStartDate" && fieldId !== "designationEndDate";

describe("FacultyFormDesignationSection — granular memo deps", () => {
  let root: Root;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderSection(draft: Record<string, unknown>): void {
    act(() => {
      root.render(
        <FacultyFormDesignationSection
          facultyDraft={draft}
          errors={{}}
          designationOptions={designationOptions}
          isFieldEnabled={isFieldEnabled}
          isFieldRequired={() => false}
          onDraftChange={vi.fn()}
        />,
      );
    });
  }

  it("recomputes employ-designation rows when profileStatus changes", () => {
    renderSection({ designationId: "des-1" });

    // No explicit status in the draft: the row resolves to the default.
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-testid="status-select-designation-0-status"]',
      )?.value,
    ).toBe("active");

    renderSection({ designationId: "des-1", profileStatus: "inactive" });

    // The employ-designation memo must key on `profileStatus` too — the
    // resolver falls back to it when no explicit status is set.
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-testid="status-select-designation-0-status"]',
      )?.value,
    ).toBe("inactive");
  });
});
