import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Student } from "@mms/shared";
import { ApiError } from "@/lib/apiError";
import { useStudentsCrudActions } from "@/tenant/features/students/hooks/useStudentsCrudActions";
import type { useStudentMutations } from "@/tenant/features/students/hooks/useStudentMutations";

const mocks = vi.hoisted(() => ({
  handleError: vi.fn(),
  notifyBulkResult: vi.fn(),
  notifyArchivedWithUndo: vi.fn(),
  bulkEnrollMutate: vi.fn(),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsCrudNotify", () => ({
  useStudentsCrudNotify: () => ({
    handleError: mocks.handleError,
    notifyBulkResult: mocks.notifyBulkResult,
    notifyArchivedWithUndo: mocks.notifyArchivedWithUndo,
  }),
}));

vi.mock("@/tenant/features/students/hooks/useStudentMutations", () => ({
  useStudentsBulkEnrollMutation: () => ({
    mutateAsync: mocks.bulkEnrollMutate,
    isPending: false,
  }),
}));

const student: Student = {
  id: "std-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  grNumber: "GR-001",
  status: "active",
  fatherName: "Harith",
  phone: "+1 555-0100",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const deleteStudent = { mutateAsync: vi.fn() };
const bulkDeleteStudents = { mutateAsync: vi.fn() };
const restoreStudent = { mutateAsync: vi.fn() };
const bulkRestoreStudents = { mutateAsync: vi.fn() };
const bulkUpdateStudentStatus = { mutateAsync: vi.fn() };
const createStudent = { mutateAsync: vi.fn() };
const updateStudent = { mutateAsync: vi.fn() };

const mutations = {
  createStudent,
  updateStudent,
  deleteStudent,
  bulkDeleteStudents,
  restoreStudent,
  bulkRestoreStudents,
  bulkUpdateStudentStatus,
} as unknown as ReturnType<typeof useStudentMutations>;

function response(status: number, body: unknown) {
  return { status, body, headers: new Headers() };
}

describe("useStudentsCrudActions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let actions: ReturnType<typeof useStudentsCrudActions>;

  function renderHook(editStudent: Student | null = null): void {
    function TestComponent() {
      actions = useStudentsCrudActions({ editStudent, mutations });
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("surfaces a 409 delete as an error without the archived/undo toast", async () => {
    deleteStudent.mutateAsync.mockResolvedValue(
      response(409, { type: "conflict", message: "Student is referenced by an invoice" }),
    );
    renderHook();

    await act(async () => {
      await actions.handleDelete("std-1", "duplicate");
    });

    expect(mocks.notifyArchivedWithUndo).not.toHaveBeenCalled();
    expect(mocks.handleError).toHaveBeenCalledTimes(1);
    const [error, scope, messageKey] = mocks.handleError.mock.calls[0] as [unknown, string, string];
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect(scope).toBe("students.delete");
    expect(messageKey).toBe("students.deleteFailed");
  });

  it("keeps the archived/undo toast on a successful delete", async () => {
    deleteStudent.mutateAsync.mockResolvedValue(response(200, { success: true }));
    renderHook();

    await act(async () => {
      await actions.handleDelete("std-1");
    });

    expect(mocks.notifyArchivedWithUndo).toHaveBeenCalledTimes(1);
    expect(mocks.handleError).not.toHaveBeenCalled();
  });

  it("rejects out of handleSaveStudent when the update returns 400", async () => {
    updateStudent.mutateAsync.mockResolvedValue(
      response(400, {
        type: "validation_error",
        message: "Invalid student",
        errors: [{ field: "grNumber", message: "GR number has an invalid format" }],
      }),
    );
    renderHook(student);

    let caught: unknown;
    await act(async () => {
      try {
        await actions.handleSaveStudent(student);
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(400);
  });

  it("returns the saved student on a successful save", async () => {
    updateStudent.mutateAsync.mockResolvedValue(response(200, { student }));
    renderHook(student);

    let saved: Student | undefined;
    await act(async () => {
      saved = await actions.handleSaveStudent(student);
    });

    expect(saved).toEqual(student);
  });

  it("surfaces a 409 bulk delete instead of reporting a bulk result", async () => {
    bulkDeleteStudents.mutateAsync.mockResolvedValue(
      response(409, { type: "conflict", message: "One or more students are locked" }),
    );
    renderHook();

    await act(async () => {
      await actions.handleBulkDelete(["std-1"]);
    });

    expect(mocks.notifyBulkResult).not.toHaveBeenCalled();
    expect(mocks.handleError).toHaveBeenCalledWith(
      expect.objectContaining({ status: 409 }),
      "students.bulk_delete",
      "students.deleteFailed",
    );
  });

  it("reports a successful bulk delete with the server counts", async () => {
    bulkDeleteStudents.mutateAsync.mockResolvedValue(response(200, { succeeded: 2, failed: 1 }));
    renderHook();

    await act(async () => {
      await actions.handleBulkDelete(["std-1", "std-2", "std-3"]);
    });

    expect(mocks.notifyBulkResult).toHaveBeenCalledWith(
      2,
      1,
      "students.deleteSuccess",
      "students.bulkDeleteSuccess",
    );
  });

  it("reports a successful bulk restore", async () => {
    bulkRestoreStudents.mutateAsync.mockResolvedValue(response(200, { succeeded: 3, failed: 0 }));
    renderHook();

    await act(async () => {
      await actions.handleBulkRestore(["std-1", "std-2", "std-3"]);
    });

    expect(mocks.notifyBulkResult).toHaveBeenCalledWith(
      3,
      0,
      "students.restoreSuccess",
      "students.bulkRestoreSuccess",
    );
  });

  it("rejects out of the bulk status change on a failed response", async () => {
    bulkUpdateStudentStatus.mutateAsync.mockResolvedValue(
      response(409, { type: "conflict", message: "Status change rejected" }),
    );
    renderHook();

    let caught: unknown;
    await act(async () => {
      try {
        await actions.handleBulkStatusChange(["std-1"], "graduated");
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(ApiError);
    expect(mocks.handleError).toHaveBeenCalledWith(
      expect.objectContaining({ status: 409 }),
      "students.bulk_status",
      "students.bulkStatusFailed",
    );
  });

  it("reports a successful bulk status change", async () => {
    bulkUpdateStudentStatus.mutateAsync.mockResolvedValue(
      response(200, { succeeded: 4, failed: 0 }),
    );
    renderHook();

    await act(async () => {
      await actions.handleBulkStatusChange(["std-1"], "inactive");
    });

    expect(mocks.notifyBulkResult).toHaveBeenCalledWith(
      4,
      0,
      "students.bulkStatusSuccess",
      "students.bulkStatusSuccessMany",
    );
  });

  it("reports a successful bulk enrollment", async () => {
    mocks.bulkEnrollMutate.mockResolvedValue(response(200, { succeeded: 2, failed: 0 }));
    renderHook();

    await act(async () => {
      await actions.handleBulkEnroll(["std-1", "std-2"], {
        sessionId: "ses-1",
        classId: "cls-1",
        mode: "add",
      });
    });

    expect(mocks.bulkEnrollMutate).toHaveBeenCalledWith({
      studentIds: ["std-1", "std-2"],
      sessionId: "ses-1",
      classId: "cls-1",
      mode: "add",
    });
    expect(mocks.notifyBulkResult).toHaveBeenCalledWith(
      2,
      0,
      "students.bulkEnrollSuccess",
      "students.bulkEnrollSuccess",
    );
  });
});
