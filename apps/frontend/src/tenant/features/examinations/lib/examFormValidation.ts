import { MAX_MARKS_OBTAINED } from "@mms/shared";

/** The mutable exam fields that participate in form validation. */
export interface ExamFormDraftShape {
  name?: string;
  date?: string;
  classIds?: string[];
  totalMarks?: number;
  passingMarks?: number;
  duration?: number;
}

export type ExamFormField =
  "name" | "date" | "classIds" | "totalMarks" | "passingMarks" | "duration";

export type ExamFormErrors = Partial<
  Record<
    ExamFormField,
    | "nameRequired"
    | "dateRequired"
    | "classRequired"
    | "totalInvalid"
    | "passingInvalid"
    | "passingExceedsTotal"
    | "durationInvalid"
  >
>;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Validates the exam authoring frame before submission.
 *
 * The modal used to validate only on submit and only name/date/classes, so Save stayed enabled with
 * `passing > total`, a zero total or a blank duration, and the errors appeared after the click.
 */
export function validateExamDraft(draft: ExamFormDraftShape): ExamFormErrors {
  const errors: ExamFormErrors = {};
  if (!draft.name?.trim()) errors.name = "nameRequired";
  if (!draft.date) errors.date = "dateRequired";
  if (!draft.classIds || draft.classIds.length === 0) errors.classIds = "classRequired";

  if (!isPositiveInteger(draft.totalMarks) || draft.totalMarks > MAX_MARKS_OBTAINED) {
    errors.totalMarks = "totalInvalid";
  }
  if (
    typeof draft.passingMarks !== "number" ||
    !Number.isInteger(draft.passingMarks) ||
    draft.passingMarks < 0
  ) {
    errors.passingMarks = "passingInvalid";
  } else if (typeof draft.totalMarks === "number" && draft.passingMarks > draft.totalMarks) {
    errors.passingMarks = "passingExceedsTotal";
  }
  if (!isPositiveInteger(draft.duration) || draft.duration < 5) {
    errors.duration = "durationInvalid";
  }
  return errors;
}

/** True when the draft differs from the persisted exam (or the empty create form). */
export function isExamDraftDirty(
  draft: ExamFormDraftShape & {
    subject?: string;
    subjectId?: string;
    description?: string;
    status?: string;
  },
  original:
    | (ExamFormDraftShape & {
        subject?: string;
        subjectId?: string;
        description?: string;
        status?: string;
      })
    | null,
): boolean {
  const compare = [
    "name",
    "date",
    "classIds",
    "totalMarks",
    "passingMarks",
    "duration",
    "subject",
    "subjectId",
    "description",
    "status",
  ] as const;
  return compare.some((key) => {
    const left = draft[key];
    const right = original?.[key];
    if (Array.isArray(left) || Array.isArray(right)) {
      return JSON.stringify(left ?? []) !== JSON.stringify(right ?? []);
    }
    return String(left ?? "") !== String(right ?? "");
  });
}

/**
 * Reads a numeric field without coercing partial input to `NaN`/0.
 * Digits only, empty = cleared (undefined); the validator then reports the missing value.
 */
export function parseIntegerInput(value: string): number | undefined {
  const digits = value.replace(/[^\d]/g, "");
  if (digits === "") return undefined;
  return Number(digits);
}
