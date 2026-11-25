import type { Exam, ExamResult } from "@/lib/data/examinationData";
import type { ExamStudent } from "../hooks/useEnterMarksStudents";

export interface PersistedMark {
  id: string;
  version?: number;
  marksObtained: number;
}

/** Persisted rows for the exam, keyed by student id (id/version/mark snapshot for the draft). */
export function persistedMarksFor(
  exam: Exam | undefined,
  results: ExamResult[],
): Map<string, PersistedMark> {
  const persisted = new Map<string, PersistedMark>();
  if (!exam) return persisted;
  for (const result of results) {
    if (result.examId !== exam.id) continue;
    persisted.set(String(result.studentId), {
      id: result.id,
      version: result.version,
      marksObtained: result.marksObtained,
    });
  }
  return persisted;
}

/** The editable grid's seed: persisted marks keyed by student id. */
export function prefilledMarksFor(
  exam: Exam | undefined,
  results: ExamResult[],
): Record<string, number | string> {
  const prefilled: Record<string, number | string> = {};
  if (!exam) return prefilled;
  for (const result of results) {
    if (result.examId === exam.id) prefilled[result.studentId] = result.marksObtained;
  }
  return prefilled;
}

/**
 * Rows to save from the current section. Blank cells are "not entered" (never a zero mark) and
 * persisted rows keep their id + OCC token from the edit-session snapshot, so an external change
 * still produces a 409 instead of being silently overwritten.
 */
export function buildMarksSavePayload(
  exam: Exam,
  students: readonly ExamStudent[],
  marks: Record<string, number | string>,
  seed: Map<string, PersistedMark>,
): ExamResult[] {
  return students.flatMap((student) => {
    const raw = marks[String(student.id)];
    if (raw === "" || raw === undefined || raw === null) return [];
    const existing = seed.get(String(student.id));
    return [
      {
        id: existing?.id ?? `er_${exam.id}_${student.id}`,
        examId: exam.id,
        studentId: String(student.id),
        marksObtained: Number(raw),
        ...(existing?.version !== undefined ? { version: existing.version } : {}),
      },
    ];
  });
}
