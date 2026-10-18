import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassSchema } from "@mms/shared";
import { ClassModal } from "./ClassModal";



vi.mock("@/hooks/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    session: { singular: "Session", plural: "Sessions" },
    class: { singular: "Class", plural: "Classes" },
    section: { singular: "Section", plural: "Sections" },
  }),
}));
vi.mock("@/hooks/useAcademicCatalog", () => ({
  useAcademicCatalogItems: () => ({ data: [] }),
  useExaminationSubjects: () => ({ data: [] }),
  useAcademicCatalogActions: () => ({ save: vi.fn(), remove: vi.fn(), restore: vi.fn(), isPending: false }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({ canRead: true, canWrite: true, canDelete: false, canEditSetup: false }),
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/collections/faculty", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/tenant/hooks/collections/faculty")>();
  return {
    ...actual,
    useFacultyContractList: () => ({
      data: { body: { faculty: [{ id: "t1", name: "Ustadh Ali", status: "active" }] } },
    }),
    useFacultyByIds: () => ({ data: [] }),
  };
});

vi.mock("@/components/ui/FormModal", () => ({
  FormModal: ({
    title,
    error,
    onSave,
    children,
  }: {
    title: React.ReactNode;
    error?: string;
    onSave?: () => void;
    children: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {error ? <div role="alert">{error}</div> : null}
      {children}
      <button data-testid="save-class-btn" type="button" onClick={onSave}>
        Save Class
      </button>
    </div>
  ),
}));

describe("ClassModal Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders class modal with input fields and accessible attributes", async () => {
    await act(async () => {
      root.render(
        <ClassModal
          open={true}
          sessionClass={null}
          onClose={vi.fn()}
          onSave={vi.fn()}
          saving={false}
        />,
      );
    });

    const nameInput = container.querySelector("#class-name") as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    expect(nameInput.name).toBe("name");
    expect(nameInput.getAttribute("aria-invalid")).toBe("false");
  });

  it("validates age range when ageMin is greater than ageMax", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(
        <ClassModal
          open={true}
          sessionClass={ClassSchema.parse({
            id: "c1",
            name: "Hifz 1",
            minAge: 15,
            maxAge: 10,
            gender: "mixed",
            facultyId: "",
            facultyName: "",
            maxStudents: 20,
            enrolled: 0,
            room: "Room 101",
          })}

          onClose={vi.fn()}
          onSave={onSave}
          saving={false}
        />,
      );
    });

    const saveBtn = container.querySelector("[data-testid='save-class-btn']") as HTMLButtonElement;
    await act(async () => {
      saveBtn.click();
    });

    expect(onSave).not.toHaveBeenCalled();
    const maxAgeInput = container.querySelector("#class-max-age") as HTMLInputElement;
    expect(maxAgeInput.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("common.formPleaseFixErrors");
  });
});
