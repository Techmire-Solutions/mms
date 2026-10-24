import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FacultyDesignationsSetupSection } from "./FacultyDesignationsSetupSection";
import type { FacultyDesignationDefinition } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockSaveMutateAsync = vi.fn().mockResolvedValue({
  id: "des-3",
  name: "Teaching Assistant",
  code: "ta",
  hierarchyRank: 5,
  isActive: true,
  assignableRoles: [],
});
const mockDeleteMutateAsync = vi.fn().mockResolvedValue(undefined);

let mockDesignationsData: FacultyDesignationDefinition[] = [
  {
    id: "des-1",
    departmentId: "dept-1",
    departmentName: "Hifz",
    name: "Head of Faculty",
    status: "active",
    assignableRoles: ["academic_head"],
  },
  {
    id: "des-2",
    departmentId: "dept-1",
    departmentName: "Hifz",
    name: "Senior Scholar",
    status: "active",
    assignableRoles: ["instructor"],
  },
];

vi.mock("../hooks/useFacultyDepartments", () => ({
  useFacultyDepartments: () => ({
    data: [{ id: "dept-1", name: "Hifz", status: "active" }],
    isLoading: false,
  }),
}));

vi.mock("../hooks/useFacultyDesignations", () => ({
  useFacultyDesignations: () => ({
    data: mockDesignationsData,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useSaveFacultyDesignation: () => ({
    mutateAsync: mockSaveMutateAsync,
    isPending: false,
  }),
  useDeleteFacultyDesignation: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
  useRestoreFacultyDesignation: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

vi.mock("@/tenant/hooks/useWorkspaceRoles", () => ({
  useWorkspaceRoles: () => [
    { id: "instructor", name: "Instructor" },
    { id: "academic_head", name: "Academic Head" },
  ],
}));

vi.mock("@/tenant/hooks/collections/users", () => ({
  RoleFormModal: () => null,
  useCreateWorkspaceRole: () => ({
    canCreate: false,
    visibleModules: [],
    createRole: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("FacultyDesignationsSetupSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockSaveMutateAsync.mockClear();
    mockDeleteMutateAsync.mockClear();
    mockDesignationsData = [
      {
        id: "des-1",
        departmentId: "dept-1",
        departmentName: "Hifz",
        name: "Head of Faculty",
        status: "active",
        assignableRoles: ["academic_head"],
      },
      {
        id: "des-2",
        departmentId: "dept-1",
        departmentName: "Hifz",
        name: "Senior Scholar",
        status: "active",
        assignableRoles: ["instructor"],
      },
    ];
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders work-directory designations table without section-header add", async () => {
    await act(async () => {
      root.render(<FacultyDesignationsSetupSection />);
    });

    expect(container.textContent).toContain("Head of Faculty");
    expect(container.textContent).toContain("Senior Scholar");
    expect(container.textContent).toContain("common.filters");
    expect(container.textContent).toContain("common.columns.trigger");
    expect(
      container.querySelector('input[placeholder="faculty.designations.searchPlaceholder"]'),
    ).not.toBeNull();

    const table = container.querySelector("table");
    expect(table).not.toBeNull();

    const addBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("faculty.designations.addDesignation"),
    );
    expect(addBtn).toBeUndefined();
  });

  it("opens edit modal when edit button in table is clicked", async () => {
    await act(async () => {
      root.render(<FacultyDesignationsSetupSection />);
    });

    const editBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="common.edit Head of Faculty"]',
    );
    expect(editBtn).not.toBeNull();

    await act(async () => {
      editBtn!.click();
    });

    const modalInput = document.querySelector<HTMLInputElement>("#modal-designation-name");
    expect(modalInput).not.toBeNull();
    expect(modalInput?.value).toBe("Head of Faculty");
  });
});
