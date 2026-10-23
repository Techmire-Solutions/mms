import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FacultyDepartmentsSetupSection } from "./FacultyDepartmentsSetupSection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockSaveMutateAsync = vi
  .fn()
  .mockResolvedValue({ id: "dept-3", name: "Fiqh & Law", code: "fiqh-law" });
const mockDeleteMutateAsync = vi.fn().mockResolvedValue(undefined);
let mockDepartmentsData = [
  { id: "dept-1", workspaceSubdomain: "tenant", name: "Quranic Studies", code: "quranic-studies" },
  { id: "dept-2", workspaceSubdomain: "tenant", name: "Hadith Sciences", code: "hadith-sciences" },
];

vi.mock("@/tenant/features/faculty/hooks/useFacultyDepartments", () => ({
  useFacultyDepartments: () => ({
    data: mockDepartmentsData,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useSaveFacultyDepartment: () => ({
    mutateAsync: mockSaveMutateAsync,
    isPending: false,
  }),
  useDeleteFacultyDepartment: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
  useRestoreFacultyDepartment: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

vi.mock("@/tenant/features/faculty/hooks/useFacultyTsrQueries", () => ({
  useFacultyContractList: () => ({
    data: { faculty: [{ id: "fac-1", name: "Prof. Tariq" }] },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.name) return `${key} ${params.name}`;
      return key;
    },
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("FacultyDepartmentsSetupSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockSaveMutateAsync.mockClear();
    mockDeleteMutateAsync.mockClear();
    mockDepartmentsData = [
      {
        id: "dept-1",
        workspaceSubdomain: "tenant",
        name: "Quranic Studies",
        code: "quranic-studies",
      },
      {
        id: "dept-2",
        workspaceSubdomain: "tenant",
        name: "Hadith Sciences",
        code: "hadith-sciences",
      },
    ];
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders work-directory departments table without section-header add", async () => {
    await act(async () => {
      root.render(<FacultyDepartmentsSetupSection />);
    });

    expect(container.textContent).toContain("Quranic Studies");
    expect(container.textContent).toContain("Hadith Sciences");
    expect(container.textContent).toContain("common.filters");
    expect(container.textContent).toContain("common.columns.trigger");
    expect(
      container.querySelector('input[placeholder="faculty.setup.searchDepartments"]'),
    ).not.toBeNull();

    const addBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("faculty.setup.addDepartment"),
    );
    expect(addBtn).toBeUndefined();
  });

  it("opens edit modal when edit button in table is clicked", async () => {
    await act(async () => {
      root.render(<FacultyDepartmentsSetupSection />);
    });

    const editBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="common.edit Quranic Studies"]',
    );
    expect(editBtn).not.toBeNull();

    await act(async () => {
      editBtn!.click();
    });

    const modalInput = document.querySelector<HTMLInputElement>("#department-form-name");
    expect(modalInput).not.toBeNull();
    expect(modalInput?.value).toBe("Quranic Studies");
  });

  it("opens confirm dialog when delete button is clicked and confirms", async () => {
    await act(async () => {
      root.render(<FacultyDepartmentsSetupSection />);
    });

    const deleteBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="common.delete Quranic Studies"]',
    );
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn!.click();
    });

    // Alert dialog opens
    expect(document.body.textContent).toContain("faculty.setup.deleteDepartment");
    const confirmBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "common.delete",
    );
    expect(confirmBtn).not.toBeUndefined();

    await act(async () => {
      confirmBtn!.click();
    });

    expect(mockDeleteMutateAsync).toHaveBeenCalledWith("dept-1");
  });
});
