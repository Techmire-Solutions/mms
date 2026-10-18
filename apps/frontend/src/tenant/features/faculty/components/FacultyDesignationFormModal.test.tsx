import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FacultyDepartmentEntity, FacultyDesignationDefinition } from "@mms/shared";
import { FacultyDesignationFormModal } from "./FacultyDesignationFormModal";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/hooks/useWorkspaceRoles", () => ({
  useWorkspaceRoles: () => [
    { id: "staff", labelKey: "users.role.staff", permissions: {}, isSystem: true },
    { id: "admin", labelKey: "users.role.admin", permissions: {}, isSystem: true },
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

const departments: FacultyDepartmentEntity[] = [
  { id: "dept-1", name: "Hadith", status: "active" },
  { id: "dept-2", name: "Fiqh", status: "active" },
  { id: "dept-off", name: "Closed", status: "inactive" },
];

const designation = (
  overrides: Partial<FacultyDesignationDefinition>,
): FacultyDesignationDefinition => ({
  id: "des",
  departmentId: "dept-1",
  name: "Lecturer",
  parentDesignationId: null,
  status: "active",
  assignableRoles: [],
  ...overrides,
});

const dean = designation({ id: "des-dean", name: "Dean", hierarchyRank: 1 });
const hod = designation({
  id: "des-hod",
  name: "Head of Department",
  parentDesignationId: "des-dean",
  hierarchyRank: 2,
});
const lecturer = designation({
  id: "des-lect",
  name: "Lecturer",
  parentDesignationId: "des-hod",
  hierarchyRank: 3,
});
const fiqhMufti = designation({ id: "des-mufti", name: "Mufti", departmentId: "dept-2" });

const selectOptionValues = (id: string) =>
  Array.from(document.querySelectorAll<HTMLOptionElement>(`${id} option`)).map((o) => o.value);

function setInputValue(el: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(el: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set?.call(
    el,
    value,
  );
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const saveButton = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes(label));

describe("FacultyDesignationFormModal", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();
  const onSave = vi.fn().mockResolvedValue(true);

  const render = (
    current: FacultyDesignationDefinition | null,
    options: FacultyDesignationDefinition[],
    defaultDepartmentId?: string,
  ) =>
    act(async () => {
      root.render(
        <FacultyDesignationFormModal
          open
          onClose={onClose}
          designation={current}
          departments={departments}
          designationOptions={options}
          isPending={false}
          defaultDepartmentId={defaultDepartmentId}
          onSave={onSave}
        />,
      );
    });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onClose.mockClear();
    onSave.mockClear();
    onSave.mockResolvedValue(true);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("given a new designation, should render department, name, parent and status (no code / rank / roles)", async () => {
    // Act
    await render(null, [dean]);

    // Assert
    expect(document.querySelector("#modal-designation-department")).not.toBeNull();
    expect(document.querySelector("#modal-designation-name")).not.toBeNull();
    expect(document.querySelector("#modal-designation-parent")).not.toBeNull();
    expect(document.querySelector("#modal-designation-status")).not.toBeNull();
    expect(document.querySelector("#modal-designation-code")).toBeNull();
    expect(document.querySelector("#modal-designation-rank")).toBeNull();
    expect(document.querySelector("#modal-designation-roles")).toBeNull();
    // Only live departments are offered.
    expect(selectOptionValues("#modal-designation-department")).toEqual(["", "dept-1", "dept-2"]);
  });

  it("given a department is chosen, should offer only that department's designations as parents", async () => {
    // Arrange
    await render(null, [dean, hod, fiqhMufti]);
    const departmentSelect = document.querySelector<HTMLSelectElement>(
      "#modal-designation-department",
    )!;
    expect(departmentSelect.disabled).toBe(false);
    expect(document.querySelector<HTMLSelectElement>("#modal-designation-parent")?.disabled).toBe(
      true,
    );

    // Act
    await act(async () => {
      setSelectValue(departmentSelect, "dept-1");
    });

    // Assert
    expect(selectOptionValues("#modal-designation-parent")).toEqual(["", "des-dean", "des-hod"]);
  });

  it("given an existing designation, should pre-populate and submit the Faculty Management payload", async () => {
    // Arrange
    await render(hod, [dean, hod, lecturer]);
    expect(document.querySelector<HTMLSelectElement>("#modal-designation-department")?.value).toBe(
      "dept-1",
    );
    expect(document.querySelector<HTMLInputElement>("#modal-designation-name")?.value).toBe(
      "Head of Department",
    );
    expect(document.querySelector<HTMLSelectElement>("#modal-designation-parent")?.value).toBe(
      "des-dean",
    );

    // Act
    await act(async () => {
      saveButton("common.save")?.click();
    });

    // Assert
    expect(onSave).toHaveBeenCalledWith({
      id: "des-hod",
      departmentId: "dept-1",
      name: "Head of Department",
      parentDesignationId: "des-dean",
      status: "active",
      assignableRoles: [],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("given an existing designation, should exclude itself and its descendants from the parent options", async () => {
    // Act
    await render(hod, [dean, hod, lecturer]);

    // Assert — Dean is allowed; HOD (self) and Lecturer (child) are not.
    expect(selectOptionValues("#modal-designation-parent")).toEqual(["", "des-dean"]);
  });

  it("given a default department and a new name, should submit with a null parent and active status", async () => {
    // Arrange
    await render(null, [dean], "dept-2");
    const nameInput = document.querySelector<HTMLInputElement>("#modal-designation-name")!;

    // Act
    await act(async () => {
      setInputValue(nameInput, "Senior Mufti");
    });
    await act(async () => {
      saveButton("faculty.designations.addDesignation")?.click();
    });

    // Assert
    expect(onSave).toHaveBeenCalledWith({
      id: undefined,
      departmentId: "dept-2",
      name: "Senior Mufti",
      parentDesignationId: null,
      status: "active",
      assignableRoles: [],
    });
  });

  it("given a duplicate name within the same department, should block the save and show the error", async () => {
    // Arrange
    await render(null, [dean, fiqhMufti], "dept-1");
    const nameInput = document.querySelector<HTMLInputElement>("#modal-designation-name")!;

    // Act
    await act(async () => {
      setInputValue(nameInput, " dean ");
    });
    await act(async () => {
      saveButton("faculty.designations.addDesignation")?.click();
    });

    // Assert
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("faculty.designations.nameDuplicate");
  });
});
