import type { FacultySettings } from "./facultyModuleSettings.js";
import { DEFAULT_FACULTY_SETTINGS } from "./facultyModuleSettings.js";
import {
  formatDeterministicSequence,
  formatTemplateSequence,
} from "../core/sequenceNumberingUtils.js";

export type FacultyEmployeeIdSettings = Pick<
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
>;

/** Format deterministic employee ID matching {PREFIX}{DELIMITER}{YEAR}{DELIMITER}{SEQUENCE}. */
export function formatDeterministicFacultyEmployeeId(
  seq: number,
  options: {
    prefix?: string;
    yearFormat?: "YYYY" | "YY";
    sequenceDigits?: number;
    delimiter?: string;
  } = {},
  dateInput?: Date | string,
): string {
  return formatDeterministicSequence(
    seq,
    {
      prefix: options.prefix?.trim() || "FAC",
      yearFormat: options.yearFormat === "YY" ? "YY" : "YYYY",
      sequenceDigits: options.sequenceDigits,
      delimiter: options.delimiter ?? "",
    },
    dateInput,
  );
}

/** @deprecated Use formatDeterministicFacultyEmployeeId */
export const formatDeterministicEmployeeId = formatDeterministicFacultyEmployeeId;

/** Format employee ID using tokenized template ({PREFIX}, {YYYY}, {YY}, {MM}, {SEQ}) or deterministic config. */
export function formatFacultyEmployeeId(
  seq: number,
  settings: Partial<FacultyEmployeeIdSettings> = {},
  dateInput?: Date | string,
): string {
  const prefix =
    settings.employeeIdPrefix?.trim() ||
    settings.idPrefix?.trim() ||
    DEFAULT_FACULTY_SETTINGS.idPrefix;
  let template =
    settings.idTemplate?.trim() || DEFAULT_FACULTY_SETTINGS.idTemplate || "{PREFIX}-{SEQ}";
  const digits = Math.max(
    1,
    Math.min(8, Number(settings.employeeIdSequenceDigits ?? settings.idDigits) || 4),
  );
  const safeSeq = Math.max(1, Math.floor(seq));

  // If template doesn't contain a sequence placeholder, safely append -{SEQ}
  if (!/\{seq\}/i.test(template)) {
    template = `${template}-{SEQ}`;
  }

  return formatTemplateSequence(template, safeSeq, digits, dateInput, prefix);
}

/** Next employee id from sequence count + tenant settings (shared FE/BE). */
export function computeNextFacultyEmployeeIdFromCount(
  count: number,
  settings: Partial<FacultyEmployeeIdSettings> = {},
  dateInput?: Date | string,
): string {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const startSeq =
    Number.isFinite(settings.idStartSeq) && Number(settings.idStartSeq) > 1
      ? Math.floor(Number(settings.idStartSeq))
      : 1;
  const nextSeq = Math.max(safeCount + 1, startSeq);
  return formatFacultyEmployeeId(nextSeq, settings, dateInput);
}

export type FacultyDuplicateCheckInput = {
  excludeId?: string;
  contactId?: string | number;
  employeeId?: string;
};

export type FacultyDuplicateReason = "contact" | "employeeId";

type FacultyRow = {
  id?: string | number;
  contactId?: string | number;
  employeeId?: string;
  deletedAt?: string;
};

/** Client-side duplicate guard before save (server authoritative on POST). */
export function findFacultyRegistrationConflict(
  faculty: FacultyRow[],
  input: FacultyDuplicateCheckInput,
): FacultyDuplicateReason | null {
  const excludeId = input.excludeId ? String(input.excludeId) : undefined;
  const employeeId = input.employeeId?.trim().toLowerCase();

  for (const row of faculty) {
    if (row.deletedAt) continue;
    if (excludeId && String(row.id) === excludeId) continue;

    if (
      input.contactId != null &&
      row.contactId != null &&
      String(input.contactId) === String(row.contactId)
    ) {
      return "contact";
    }

    if (
      employeeId &&
      row.employeeId &&
      employeeId === String(row.employeeId).trim().toLowerCase()
    ) {
      return "employeeId";
    }
  }

  return null;
}
