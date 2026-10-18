import { DEFAULT_FACULTY_SETTINGS, type FacultySettings } from "./facultyModuleSettings.js";
import { buildSequenceFormulaTemplate } from "../core/sequenceNumberingUtils.js";

export type FacultyModulePreferences = Pick<
  FacultySettings,
  | "idPrefix"
  | "idTemplate"
  | "idDigits"
  | "idStartSeq"
  | "idRestartAnnually"
  | "employeeIdPrefix"
  | "employeeIdYearFormat"
  | "employeeIdSequenceDigits"
  | "employeeIdDelimiter"
  | "employeeIdLastYear"
  | "employeeIdCurrentSequence"
  | "autoGenerateId"
  | "requireContactLink"
  | "defaultSpecialization"
>;

export const FACULTY_MODULE_PREFERENCE_KEYS = [
  "idPrefix",
  "idTemplate",
  "idDigits",
  "idStartSeq",
  "idRestartAnnually",
  "employeeIdPrefix",
  "employeeIdYearFormat",
  "employeeIdSequenceDigits",
  "employeeIdDelimiter",
  "employeeIdLastYear",
  "employeeIdCurrentSequence",
  "autoGenerateId",
  "requireContactLink",
  "defaultSpecialization",
] as const;

/** Normalize Faculty module preferences (typed `faculty_module_preferences`). */
export function normalizeFacultyModulePreferences(
  partial?: Partial<FacultyModulePreferences> | Record<string, unknown> | null,
): FacultyModulePreferences {
  const defaults: FacultyModulePreferences = {
    idPrefix: DEFAULT_FACULTY_SETTINGS.idPrefix,
    idTemplate: DEFAULT_FACULTY_SETTINGS.idTemplate ?? "{PREFIX}{YYYY}{SEQ}",
    idDigits: DEFAULT_FACULTY_SETTINGS.idDigits ?? 4,
    idStartSeq: DEFAULT_FACULTY_SETTINGS.idStartSeq ?? 1,
    idRestartAnnually: DEFAULT_FACULTY_SETTINGS.idRestartAnnually ?? false,
    employeeIdPrefix: DEFAULT_FACULTY_SETTINGS.employeeIdPrefix ?? "FAC",
    employeeIdYearFormat: DEFAULT_FACULTY_SETTINGS.employeeIdYearFormat ?? "YYYY",
    employeeIdSequenceDigits: DEFAULT_FACULTY_SETTINGS.employeeIdSequenceDigits ?? 4,
    employeeIdDelimiter: DEFAULT_FACULTY_SETTINGS.employeeIdDelimiter ?? "",
    employeeIdLastYear: DEFAULT_FACULTY_SETTINGS.employeeIdLastYear,
    employeeIdCurrentSequence: DEFAULT_FACULTY_SETTINGS.employeeIdCurrentSequence ?? 0,
    autoGenerateId: DEFAULT_FACULTY_SETTINGS.autoGenerateId,
    requireContactLink: DEFAULT_FACULTY_SETTINGS.requireContactLink,
    defaultSpecialization: DEFAULT_FACULTY_SETTINGS.defaultSpecialization,
  };
  if (!partial || typeof partial !== "object") return { ...defaults };

  const rawPrefix = partial.employeeIdPrefix ?? partial.idPrefix;
  const effectivePrefix =
    typeof rawPrefix === "string" && rawPrefix.trim() ? rawPrefix.trim() : defaults.idPrefix;

  const parsedDigits = Number(partial.employeeIdSequenceDigits ?? partial.idDigits);
  const effectiveDigits =
    Number.isFinite(parsedDigits) && parsedDigits >= 1 && parsedDigits <= 8
      ? Math.floor(parsedDigits)
      : defaults.idDigits;

  const parsedStartSeq = Number(partial.idStartSeq);
  const parsedCurrentSeq = Number(partial.employeeIdCurrentSequence);
  const parsedLastYear = Number(partial.employeeIdLastYear);
  const yearFormat =
    String(partial.employeeIdYearFormat ?? "").toUpperCase() === "YY" ? "YY" : "YYYY";
  const delimiter =
    typeof partial.employeeIdDelimiter === "string"
      ? partial.employeeIdDelimiter
      : defaults.employeeIdDelimiter;

  return {
    idPrefix: effectivePrefix,
    employeeIdPrefix: effectivePrefix,
    idTemplate: buildSequenceFormulaTemplate({
      prefix: effectivePrefix,
      yearFormat,
      delimiter,
    }),
    idDigits: effectiveDigits,
    employeeIdSequenceDigits: effectiveDigits,
    idStartSeq:
      Number.isFinite(parsedStartSeq) && parsedStartSeq >= 1
        ? Math.floor(parsedStartSeq)
        : defaults.idStartSeq,
    idRestartAnnually:
      typeof partial.idRestartAnnually === "boolean"
        ? partial.idRestartAnnually
        : defaults.idRestartAnnually,
    employeeIdYearFormat: yearFormat,
    employeeIdDelimiter: delimiter,
    employeeIdLastYear: Number.isFinite(parsedLastYear)
      ? Math.floor(parsedLastYear)
      : defaults.employeeIdLastYear,
    employeeIdCurrentSequence:
      Number.isFinite(parsedCurrentSeq) && parsedCurrentSeq >= 0
        ? Math.floor(parsedCurrentSeq)
        : defaults.employeeIdCurrentSequence,
    autoGenerateId:
      typeof partial.autoGenerateId === "boolean"
        ? partial.autoGenerateId
        : defaults.autoGenerateId,
    // Contact link is product-compulsory — never honor a stored false.
    requireContactLink: true,
    defaultSpecialization:
      typeof partial.defaultSpecialization === "string" && partial.defaultSpecialization.trim()
        ? partial.defaultSpecialization
        : defaults.defaultSpecialization,
  };
}
