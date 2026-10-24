import { describe, expect, it, vi } from "vitest";
import {
  createExaminationsSaveExamHandler,
  createExaminationsSaveResultsHandler,
  createExaminationsDeleteExamHandler,
  createExaminationsRestoreExamHandler,
  createExaminationsBulkDeleteHandler,
  createExaminationsBulkRestoreHandler,
} from "./examinationsPageControllerActions";
import type { Exam } from "@/lib/data/examinationData";

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockExam: Exam = {
  id: "ex-1",
  name: "Tajweed Test",
  subject: "Tajweed",
  date: "2025-01-01",
  duration: 60,
  totalMarks: 100,
  passingMarks: 50,
  classIds: ["cls-1"],
  status: "upcoming",
  description: "",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

describe("examinationsPageControllerActions", () => {
  it("handles save exam, save results, delete, restore, and bulk operations", async () => {
    const replaceExams = { mutateAsync: vi.fn().mockResolvedValue({}) };
    const replaceExamResults = { mutateAsync: vi.fn().mockResolvedValue({}) };
    const deleteExam = { mutateAsync: vi.fn().mockResolvedValue({}) };
    const restoreExam = { mutateAsync: vi.fn().mockResolvedValue({}) };
    const bulkDeleteExams = { mutateAsync: vi.fn().mockResolvedValue({ succeeded: 2, failed: 0 }) };
    const bulkRestoreExams = {
      mutateAsync: vi.fn().mockResolvedValue({ succeeded: 2, failed: 0 }),
    };
    const setShowExamForm = vi.fn();
    const setEditExam = vi.fn();

    const deps = {
      exams: [mockExam],
      examResults: [],
      t: ((key: string) => key) as unknown as never,
      replaceExams,
      replaceExamResults,
      deleteExam,
      restoreExam,
      bulkDeleteExams,
      bulkRestoreExams,
      setShowExamForm,
      setEditExam,
    };

    const handleSaveExam = createExaminationsSaveExamHandler(deps);
    await handleSaveExam(mockExam);
    expect(replaceExams.mutateAsync).toHaveBeenCalled();
    expect(setShowExamForm).toHaveBeenCalledWith(false);

    const handleSaveResults = createExaminationsSaveResultsHandler(deps);
    await handleSaveResults("ex-1", [
      { id: "r-1", examId: "ex-1", studentId: "std-1", marksObtained: 90 },
    ]);
    expect(replaceExamResults.mutateAsync).toHaveBeenCalled();

    const handleDeleteExam = createExaminationsDeleteExamHandler(deps);
    await handleDeleteExam("ex-1");
    expect(deleteExam.mutateAsync).toHaveBeenCalledWith("ex-1");

    const handleRestoreExam = createExaminationsRestoreExamHandler(deps);
    await handleRestoreExam("ex-1");
    expect(restoreExam.mutateAsync).toHaveBeenCalledWith("ex-1");

    const handleBulkDelete = createExaminationsBulkDeleteHandler(deps);
    await handleBulkDelete(["ex-1", "ex-2"]);
    expect(bulkDeleteExams.mutateAsync).toHaveBeenCalledWith(["ex-1", "ex-2"]);

    const handleBulkRestore = createExaminationsBulkRestoreHandler(deps);
    await handleBulkRestore(["ex-1", "ex-2"]);
    expect(bulkRestoreExams.mutateAsync).toHaveBeenCalledWith(["ex-1", "ex-2"]);
  });
});
