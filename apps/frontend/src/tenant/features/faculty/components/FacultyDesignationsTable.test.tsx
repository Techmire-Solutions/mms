import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FacultyDesignationDefinition } from "@mms/shared";
import { FacultyDesignationsTable } from "./FacultyDesignationsTable";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockDesignations: FacultyDesignationDefinition[] = [
  {
    id: "des-1",
    departmentId: "dept-1",
    departmentName: "Hadith",
    name: "Senior Lecturer",
    parentDesignationId: "des-dean",
    parentDesignationName: "Dean",
    hierarchyRank: 2,
    status: "active",
    assignableRoles: [],
  },
  {
    id: "des-2",
    departmentId: "dept-2",
    departmentName: "Fiqh",
    name: "Adjunct Professor",
    parentDesignationId: null,
    hierarchyRank: 1,
    status: "inactive",
    assignableRoles: [],
  },
];

describe("FacultyDesignationsTable", () => {
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

  it("renders table headers and rows with designation details", async () => {
    await act(async () => {
      root.render(
        <FacultyDesignationsTable
          designations={mockDesignations}
          isPending={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      );
    });

    const headers = container.querySelectorAll("th");
    expect(headers.length).toBe(5);
    expect(container.textContent).toContain("faculty.designations.department");
    expect(container.textContent).toContain("faculty.designations.parentDesignation");
    expect(container.textContent).toContain("Senior Lecturer");
    expect(container.textContent).toContain("Hadith");
    expect(container.textContent).toContain("Dean");
    expect(container.textContent).toContain("Adjunct Professor");
    expect(container.textContent).toContain("faculty.status.inactive");
    expect(container.textContent).not.toContain("faculty.designations.code");
    expect(container.textContent).not.toContain("faculty.designations.roles");
  });

  it("triggers onEdit callback when edit button is clicked", async () => {
    await act(async () => {
      root.render(
        <FacultyDesignationsTable
          designations={mockDesignations}
          isPending={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      );
    });

    const editBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="common.edit Senior Lecturer"]',
    );
    expect(editBtn).not.toBeNull();

    await act(async () => {
      editBtn!.click();
    });

    expect(onEdit).toHaveBeenCalledWith(mockDesignations[0]);
  });

  it("triggers onDelete when delete action button is clicked", async () => {
    await act(async () => {
      root.render(
        <FacultyDesignationsTable
          designations={mockDesignations}
          isPending={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      );
    });

    const deleteBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="common.delete Adjunct Professor"]',
    );
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn!.click();
    });

    expect(onDelete).toHaveBeenCalledWith(mockDesignations[1]);
  });

  it("highlights currently edited row when editingDesignationId matches", async () => {
    await act(async () => {
      root.render(
        <FacultyDesignationsTable
          designations={mockDesignations}
          editingDesignationId="des-1"
          isPending={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      );
    });

    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].className).toContain("ring-primary");
  });

  it("hides row actions when canWrite is false", async () => {
    await act(async () => {
      root.render(
        <FacultyDesignationsTable
          designations={mockDesignations}
          isPending={false}
          canWrite={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      );
    });

    expect(container.querySelector('button[aria-label^="common.edit"]')).toBeNull();
    expect(container.querySelector('button[aria-label^="common.delete"]')).toBeNull();
  });

  it("renders empty state when no designations exist", async () => {
    await act(async () => {
      root.render(
        <FacultyDesignationsTable
          designations={[]}
          isPending={false}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      );
    });

    expect(container.textContent).toContain("faculty.designations.setupHint");
  });
});
