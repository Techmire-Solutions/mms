import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FacultyDepartmentEntity } from "@mms/shared";
import { FacultyDepartmentsTable } from "./FacultyDepartmentsTable";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockDepartments: FacultyDepartmentEntity[] = [
  {
    id: "dept-1",
    workspaceSubdomain: "tenant",
    name: "Islamic Studies",
    description: "Core Islamic sciences",
    status: "active",
    designationCount: 3,
  },
  {
    id: "dept-2",
    workspaceSubdomain: "tenant",
    name: "Hadith",
    description: null,
    status: "inactive",
    designationCount: 0,
  },
];

describe("FacultyDepartmentsTable", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onEdit = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onEdit.mockClear();
    onDelete.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders table headers and rows with department details", async () => {
    await act(async () => {
      root.render(
        <FacultyDepartmentsTable
          departments={mockDepartments}
          isPending={false}
          isLoading={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      );
    });

    const headers = container.querySelectorAll("th");
    expect(headers.length).toBe(5);
    expect(container.textContent).toContain("faculty.setup.departmentDescription");
    expect(container.textContent).toContain("faculty.setup.departmentDesignationCount");
    expect(container.textContent).toContain("Islamic Studies");
    expect(container.textContent).toContain("Core Islamic sciences");
    expect(container.textContent).toContain("Hadith");
    expect(container.textContent).toContain("faculty.status.active");
    expect(container.textContent).toContain("faculty.status.inactive");
    expect(container.textContent).not.toContain("faculty.setup.departmentCode");
    expect(container.textContent).not.toContain("faculty.setup.parentDepartment");
  });

  it("triggers onEdit when edit action button is clicked", async () => {
    await act(async () => {
      root.render(
        <FacultyDepartmentsTable
          departments={mockDepartments}
          isPending={false}
          isLoading={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      );
    });

    const editBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="common.edit Hadith"]',
    );
    expect(editBtn).not.toBeNull();

    await act(async () => {
      editBtn!.click();
    });

    expect(onEdit).toHaveBeenCalledWith(mockDepartments[1]);
  });

  it("triggers onDelete when delete action button is clicked", async () => {
    await act(async () => {
      root.render(
        <FacultyDepartmentsTable
          departments={mockDepartments}
          isPending={false}
          isLoading={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      );
    });

    const deleteBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="common.delete Hadith"]',
    );
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn!.click();
    });

    expect(onDelete).toHaveBeenCalledWith(mockDepartments[1]);
  });

  it("hides row actions when canWrite is false", async () => {
    await act(async () => {
      root.render(
        <FacultyDepartmentsTable
          departments={mockDepartments}
          isPending={false}
          isLoading={false}
          canWrite={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      );
    });

    expect(container.querySelector('button[aria-label="common.edit Hadith"]')).toBeNull();
    expect(container.querySelector('button[aria-label="common.delete Hadith"]')).toBeNull();
  });

  it("displays empty state row when no departments exist and not loading", async () => {
    await act(async () => {
      root.render(
        <FacultyDepartmentsTable
          departments={[]}
          isPending={false}
          isLoading={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      );
    });

    expect(container.textContent).toContain("faculty.setup.noDepartments");
  });
});
