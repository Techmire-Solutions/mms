import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { type Exam, type ExamResult } from "@/lib/data/examinationData";
import { notify } from "@/lib/notify";
import { NotifiedMutationError } from "@/lib/notifiedMutationError";

export interface ExaminationsMutationDeps {
  exams: Exam[];
  examResults: ExamResult[];
  t: TranslationFunction;
  replaceExams: { mutateAsync: (exams: Exam[]) => Promise<unknown> };
  replaceExamResults: { mutateAsync: (results: ExamResult[]) => Promise<unknown> };
  deleteExam: { mutateAsync: (id: string) => Promise<unknown> };
  restoreExam: { mutateAsync: (id: string) => Promise<unknown> };
  bulkDeleteExams: {
    mutateAsync: (ids: string[]) => Promise<{ succeeded: number; failed: number }>;
  };
  bulkRestoreExams: {
    mutateAsync: (ids: string[]) => Promise<{ succeeded: number; failed: number }>;
  };
  setShowExamForm: (open: boolean) => void;
  setEditExam: (exam: Exam | null) => void;
}

export function createExaminationsNotifySaveFailure(t: TranslationFunction) {
  return (error: unknown) => {
    if (error instanceof NotifiedMutationError) return;
    notify.error(t("examinations.saveFailed"), {
      description: error instanceof Error ? error.message : String(error),
    });
  };
}

export function createExaminationsSaveExamHandler(deps: ExaminationsMutationDeps) {
  const notifySaveFailure = createExaminationsNotifySaveFailure(deps.t);

  return async (exam: Exam): Promise<void> => {
    const existingExam = deps.exams.find((candidate) => candidate.id === exam.id);
    try {
      await deps.replaceExams.mutateAsync(
        existingExam
          ? deps.exams.map((candidate) => (candidate.id === exam.id ? exam : candidate))
          : [...deps.exams, exam],
      );
      deps.setShowExamForm(false);
      deps.setEditExam(null);
    } catch (error: unknown) {
      notifySaveFailure(error);
      throw error;
    }
  };
}

export function createExaminationsSaveResultsHandler(
  deps: Pick<ExaminationsMutationDeps, "examResults" | "replaceExamResults" | "t">,
) {
  const notifySaveFailure = createExaminationsNotifySaveFailure(deps.t);

  return async (examId: string, newResults: ExamResult[]): Promise<void> => {
    try {
      await deps.replaceExamResults.mutateAsync([
        ...deps.examResults.filter((result) => result.examId !== examId),
        ...newResults,
      ]);
    } catch (error: unknown) {
      notifySaveFailure(error);
      throw error;
    }
  };
}

export function createExaminationsDeleteExamHandler(
  deps: Pick<ExaminationsMutationDeps, "deleteExam" | "t">,
) {
  return async (id: string) => {
    try {
      await deps.deleteExam.mutateAsync(id);
      notify.success(deps.t("examinations.trash.deleted"));
    } catch (error: unknown) {
      notify.error(deps.t("examinations.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

export function createExaminationsRestoreExamHandler(
  deps: Pick<ExaminationsMutationDeps, "restoreExam" | "t">,
) {
  return async (id: string) => {
    try {
      await deps.restoreExam.mutateAsync(id);
      notify.success(deps.t("examinations.trash.restored"));
    } catch (error: unknown) {
      notify.error(deps.t("examinations.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

export function createExaminationsBulkDeleteHandler(
  deps: Pick<ExaminationsMutationDeps, "bulkDeleteExams" | "t">,
) {
  return async (ids: string[]) => {
    try {
      const result = await deps.bulkDeleteExams.mutateAsync(ids);
      if (result.failed > 0) {
        notify.warning(
          deps.t("examinations.trash.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else if (result.succeeded > 1) {
        notify.success(deps.t("examinations.trash.bulkDeleted", { count: result.succeeded }));
      } else {
        notify.success(deps.t("examinations.trash.deleted"));
      }
    } catch (error: unknown) {
      notify.error(deps.t("examinations.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

export function createExaminationsBulkRestoreHandler(
  deps: Pick<ExaminationsMutationDeps, "bulkRestoreExams" | "t">,
) {
  return async (ids: string[]) => {
    try {
      const result = await deps.bulkRestoreExams.mutateAsync(ids);
      if (result.failed > 0) {
        notify.warning(
          deps.t("examinations.trash.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else if (result.succeeded > 1) {
        notify.success(deps.t("examinations.trash.bulkRestored", { count: result.succeeded }));
      } else {
        notify.success(deps.t("examinations.trash.restored"));
      }
    } catch (error: unknown) {
      notify.error(deps.t("examinations.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}
