import { DEFAULT_STUDENTS_SETTINGS, type StudentsSettings } from "./studentsModuleSettings.js";
import type { SequenceRolloverPolicy, SequenceYearFormat } from "../core/sequenceNumberingTypes.js";

export type StudentModulePreferences = Pick<
  StudentsSettings,
  | "autoGenerateId"
  | "grNumberTemplate"
  | "grNumberDigits"
  | "grNumberRestartAnnually"
  | "grNumberPrefix"
  | "grNumberYearFormat"
  | "grNumberDelimiter"
  | "grNumberStartSeq"
  | "grNumberCurrentSeq"
> & {
  grNumberStartingSequence?: number;
  grNumberCurrentSequence?: number;
  grNumberRolloverPolicy?: SequenceRolloverPolicy;
};

export const STUDENT_MODULE_PREFERENCE_KEYS = [
  "autoGenerateId",
  "grNumberTemplate",
  "grNumberDigits",
  "grNumberRestartAnnually",
  "grNumberPrefix",
  "grNumberYearFormat",
  "grNumberDelimiter",
  "grNumberStartSeq",
  "grNumberStartingSequence",
  "grNumberCurrentSeq",
  "grNumberCurrentSequence",
  "grNumberRolloverPolicy",
] as const;

/** Normalize GR / auto-id preferences (typed `student_module_preferences`). */
export function normalizeStudentModulePreferences(
  partial?: Partial<StudentModulePreferences> | Record<string, unknown> | null,
): StudentModulePreferences {
  const defaults: StudentModulePreferences = {
    autoGenerateId: DEFAULT_STUDENTS_SETTINGS.autoGenerateId,
    grNumberTemplate: DEFAULT_STUDENTS_SETTINGS.grNumberTemplate,
    grNumberDigits: DEFAULT_STUDENTS_SETTINGS.grNumberDigits,
    grNumberRestartAnnually: DEFAULT_STUDENTS_SETTINGS.grNumberRestartAnnually,
  };
  if (!partial || typeof partial !== "object") return { ...defaults };

  const result: StudentModulePreferences = {
    autoGenerateId:
      typeof partial.autoGenerateId === "boolean"
        ? partial.autoGenerateId
        : defaults.autoGenerateId,
    grNumberTemplate:
      typeof partial.grNumberTemplate === "string" && partial.grNumberTemplate.trim()
        ? partial.grNumberTemplate
        : defaults.grNumberTemplate,
    grNumberDigits:
      typeof partial.grNumberDigits === "number" && Number.isFinite(partial.grNumberDigits)
        ? Math.max(1, Math.floor(partial.grNumberDigits))
        : defaults.grNumberDigits,
    grNumberRestartAnnually:
      typeof partial.grNumberRestartAnnually === "boolean"
        ? partial.grNumberRestartAnnually
        : defaults.grNumberRestartAnnually,
  };

  if (typeof partial.grNumberPrefix === "string") {
    result.grNumberPrefix = partial.grNumberPrefix;
  }
  if (typeof partial.grNumberYearFormat === "string") {
    result.grNumberYearFormat = partial.grNumberYearFormat as SequenceYearFormat;
  }
  if (typeof partial.grNumberDelimiter === "string") {
    result.grNumberDelimiter = partial.grNumberDelimiter;
  }
  if (typeof partial.grNumberStartSeq === "number" && Number.isFinite(partial.grNumberStartSeq)) {
    result.grNumberStartSeq = partial.grNumberStartSeq;
  }
  if (
    typeof partial.grNumberStartingSequence === "number" &&
    Number.isFinite(partial.grNumberStartingSequence)
  ) {
    result.grNumberStartingSequence = partial.grNumberStartingSequence;
  }
  if (
    typeof partial.grNumberCurrentSeq === "number" &&
    Number.isFinite(partial.grNumberCurrentSeq)
  ) {
    result.grNumberCurrentSeq = partial.grNumberCurrentSeq;
  }
  if (
    typeof partial.grNumberCurrentSequence === "number" &&
    Number.isFinite(partial.grNumberCurrentSequence)
  ) {
    result.grNumberCurrentSequence = partial.grNumberCurrentSequence;
  }
  if (typeof partial.grNumberRolloverPolicy === "string") {
    result.grNumberRolloverPolicy = partial.grNumberRolloverPolicy as SequenceRolloverPolicy;
  }

  return result;
}
