import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FacultyDepartmentEntity } from "@mms/shared";
import { slugifyFacultyCatalogCode } from "@mms/shared";
import { useFacultyDepartmentsController } from "./useFacultyDepartmentsController";
import { notify } from "@/lib/notify";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockSaveMutateAsync = vi
  .fn()
  .mockResolvedValue({ id: "dept-3", name: "Fiqh", status: "active" });
const mockDeleteMutateAsync = vi.fn().mockResolvedValue(undefined);

const testDepartments: FacultyDepartmentEntity[] = [
  { id: "dept-1", workspaceSubdomain: "tenant", name: "Islamic Studies", status: "active" },
  { id: "dept-2", workspaceSubdomain: "tenant", name: "Hadith", status: "inactive" },
  { id: "dept-3", workspaceSubdomain: "tenant", name: "Languages", status: "active" },
];

vi.mock("./useFacultyDepartments", () => ({
  useFacultyDepartments: () => ({
    data: testDepartments,
    isLoading: false,
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

describe("useFacultyDepartmentsController", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let hookValue: ReturnType<typeof useFacultyDepartmentsController>;

  function TestHarness() {
    hookValue = useFacultyDepartmentsController();
    return null;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockSaveMutateAsync.mockClear();
    mockDeleteMutateAsync.mockClear();
    vi.mocked(notify.error).mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("given a catalog name, should slugify it for legacy code consumers", () => {
    expect(slugifyFacultyCatalogCode("Quran & Sunnah")).toBe("quran-sunnah");
    expect(slugifyFacultyCatalogCode("  Islamic Studies! ")).toBe("islamic-studies");
  });

  it("given mixed statuses, should list active departments first then by name", async () => {
    await act(async () => {
      root.render(<TestHarness />);
    });

    expect(hookValue.orderedDepartments.map((d) => d.id)).toEqual(["dept-1", "dept-3", "dept-2"]);
  });

  it("given a duplicate name, should notify and skip the save", async () => {
    await act(async () => {
      root.render(<TestHarness />);
    });

    const saved = await hookValue.saveDepartment({ name: "Hadith", status: "active" });

    expect(saved).toBeNull();
    expect(mockSaveMutateAsync).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith("faculty.setup.departmentNameDuplicate");
  });

  it("given a new department, should persist name, description and status", async () => {
    await act(async () => {
      root.render(<TestHarness />);
    });

    await hookValue.saveDepartment({ name: "Fiqh", description: "Usul", status: "active" });

    expect(mockSaveMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Fiqh",
        description: "Usul",
        status: "active",
      }),
    );
  });

  it("given delete, should call the mutation with the department id", async () => {
    await act(async () => {
      root.render(<TestHarness />);
    });

    const ok = await hookValue.handleDelete(testDepartments[1]);

    expect(ok).toBe(true);
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith("dept-2");
  });
});
