import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useFacultyWorkTierActions,
  type UseFacultyWorkTierActionsProps,
  type UseFacultyWorkTierActionsReturn,
} from "./useFacultyWorkTierActions";
import type { Faculty } from "@mms/contracts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/faculty/hooks/useFacultyStatusConfig", () => {
  const config = () => ({
    active: { label: "Active", cls: "text-emerald-700" },
  });
  return {
    useFacultyStatusConfig: config,
  };
});

function TestHarness({
  props,
  onHook,
}: {
  props: UseFacultyWorkTierActionsProps;
  onHook: (actions: UseFacultyWorkTierActionsReturn) => void;
}) {
  const actions = useFacultyWorkTierActions(props);
  onHook(actions);
  return null;
}

describe("useFacultyWorkTierActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  const directoryFilterProps: Pick<
    UseFacultyWorkTierActionsProps,
    | "filterDepartment"
    | "filterDesignation"
    | "filterReportingFacultyId"
    | "supervisorFilterOptions"
    | "onDepartmentChange"
    | "onDesignationChange"
    | "onReportingFacultyChange"
  > = {
    filterDepartment: "",
    filterDesignation: "",
    filterReportingFacultyId: "",
    supervisorFilterOptions: [],
    onDepartmentChange: vi.fn(),
    onDesignationChange: vi.fn(),
    onReportingFacultyChange: vi.fn(),
  };

  const mockFaculty: Faculty = {
    id: "fac-1",
    contactId: "cnt-1",
    name: "Ustadh Umar",
    status: "active",
    employeeId: "EMP-010",
    gender: "male",
    specialization: "Tajweed",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("handles bulk status change and clears selection", async () => {
    const onBulkStatusChange = vi.fn().mockResolvedValue(undefined);
    const onClearSelection = vi.fn();
    let hookActions!: UseFacultyWorkTierActionsReturn;

    await act(async () => {
      root.render(
        <TestHarness
          props={{
            filterStatus: ["active"],
            filterSpecialization: "all",
            filterGender: "all",
            ...directoryFilterProps,
            onToggleStatus: vi.fn(),
            onSpecializationChange: vi.fn(),
            onGenderChange: vi.fn(),
            sortField: "name",
            sortDir: "asc",
            onSortChange: vi.fn(),
            selectedIds: ["fac-1"],
            faculty: [mockFaculty],
            onBulkStatusChange,
            onClearSelection,
          }}
          onHook={(actions) => {
            hookActions = actions;
          }}
        />,
      );
    });

    await act(async () => {
      await hookActions.handleBulkStatusChange("inactive");
    });

    expect(onBulkStatusChange).toHaveBeenCalledWith(["fac-1"], "inactive");
    expect(onClearSelection).toHaveBeenCalled();
  });

  it("handles sort field change with direction toggling", async () => {
    const onSortChange = vi.fn();
    let hookActions!: UseFacultyWorkTierActionsReturn;

    await act(async () => {
      root.render(
        <TestHarness
          props={{
            filterStatus: [],
            filterSpecialization: "all",
            filterGender: "all",
            ...directoryFilterProps,
            onToggleStatus: vi.fn(),
            onSpecializationChange: vi.fn(),
            onGenderChange: vi.fn(),
            sortField: "name",
            sortDir: "asc",
            onSortChange,
            selectedIds: [],
            faculty: [mockFaculty],
            onClearSelection: vi.fn(),
          }}
          onHook={(actions) => {
            hookActions = actions;
          }}
        />,
      );
    });

    // Clicking the same field toggles direction to desc
    act(() => {
      hookActions.handleSortFieldChange("name");
    });
    expect(onSortChange).toHaveBeenCalledWith("name", "desc");

    // Clicking a different field defaults to asc
    act(() => {
      hookActions.handleSortFieldChange("employeeId");
    });
    expect(onSortChange).toHaveBeenCalledWith("employeeId", "asc");
  });
});
