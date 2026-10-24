import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FacultyDepartmentEntity } from "@mms/shared";
import { FacultyDepartmentFormModal } from "./FacultyDepartmentFormModal";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const existingDept: FacultyDepartmentEntity = {
  id: "dept-1",
  workspaceSubdomain: "tenant",
  name: "Quran Studies",
  description: "Tajweed and Hifz",
  status: "active",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
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

describe("FacultyDepartmentFormModal", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();
  const onSave = vi.fn().mockResolvedValue(true);

  const render = (
    department: FacultyDepartmentEntity | null,
    existing: FacultyDepartmentEntity[] = [],
  ) =>
    act(async () => {
      root.render(
        <FacultyDepartmentFormModal
          open
          onClose={onClose}
          department={department}
          existingDepartments={existing}
          isPending={false}
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

  it("given no department, should render name, description and status (no code / parent fields)", async () => {
    // Act
    await render(null);

    // Assert
    expect(document.querySelector("#department-form-name")).not.toBeNull();
    expect(document.querySelector("#department-form-description")).not.toBeNull();
    expect(document.querySelector<HTMLSelectElement>("#department-form-status")?.value).toBe(
      "active",
    );
    expect(document.querySelector("#department-form-code")).toBeNull();
    expect(document.querySelector("#department-form-parent")).toBeNull();
    expect(document.body.textContent).toContain("faculty.setup.addDepartment");
  });

  it("given an existing department, should pre-populate and submit name/description/status with its id", async () => {
    // Arrange
    await render(existingDept, [existingDept]);
    expect(document.querySelector<HTMLInputElement>("#department-form-name")?.value).toBe(
      "Quran Studies",
    );
    expect(document.querySelector<HTMLTextAreaElement>("#department-form-description")?.value).toBe(
      "Tajweed and Hifz",
    );

    // Act
    await act(async () => {
      saveButton("faculty.setup.updateDepartment")?.click();
    });

    // Assert
    expect(onSave).toHaveBeenCalledWith({
      id: "dept-1",
      name: "Quran Studies",
      description: "Tajweed and Hifz",
      status: "active",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('given inactive status selected, should submit status "inactive" and a null description', async () => {
    // Arrange
    await render(null);
    const nameInput = document.querySelector<HTMLInputElement>("#department-form-name")!;
    const statusSelect = document.querySelector<HTMLSelectElement>("#department-form-status")!;

    // Act
    await act(async () => {
      setInputValue(nameInput, "Fiqh");
      setSelectValue(statusSelect, "inactive");
    });
    await act(async () => {
      saveButton("faculty.setup.addDepartment")?.click();
    });

    // Assert
    expect(onSave).toHaveBeenCalledWith({
      id: undefined,
      name: "Fiqh",
      description: null,
      status: "inactive",
    });
  });

  it("given a name that duplicates another live department (case-insensitive), should block save and show the error", async () => {
    // Arrange
    await render(null, [existingDept]);
    const nameInput = document.querySelector<HTMLInputElement>("#department-form-name")!;

    // Act
    await act(async () => {
      setInputValue(nameInput, "  quran studies ");
    });
    await act(async () => {
      saveButton("faculty.setup.addDepartment")?.click();
    });

    // Assert
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("faculty.setup.departmentNameDuplicate");
  });

  it("given the save resolves false, should keep the modal open", async () => {
    // Arrange
    onSave.mockResolvedValueOnce(false);
    await render(existingDept, [existingDept]);

    // Act
    await act(async () => {
      saveButton("faculty.setup.updateDepartment")?.click();
    });

    // Assert
    expect(onSave).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
