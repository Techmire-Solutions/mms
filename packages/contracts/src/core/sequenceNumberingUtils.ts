import type {
  SequenceNumberingConfig,
  SequenceYearFormat,
  SequenceRolloverPolicy,
} from "./sequenceNumberingTypes.js";

export type { SequenceNumberingConfig, SequenceYearFormat, SequenceRolloverPolicy };

/** Formats a deterministic sequence ID given a sequence number, configuration, and reference date. */
export function formatDeterministicSequence(
  sequenceNumber: number,
  config: Partial<SequenceNumberingConfig> = {},
  dateInput?: Date | string,
): string {
  const prefix = config.prefix?.trim() ?? "";
  const delimiter = config.delimiter ?? "";
  const digits = Math.max(2, Math.min(8, Number(config.sequenceDigits) || 4));
  const yearFormat: SequenceYearFormat = config.yearFormat ?? "YYYY";

  const parsedDate = dateInput
    ? dateInput instanceof Date
      ? dateInput
      : new Date(dateInput)
    : new Date();
  const validDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const fullYear = validDate.getFullYear();
  const month = validDate.getMonth() + 1;

  const parts: string[] = [];
  if (prefix.length > 0) {
    parts.push(prefix);
  }

  if (yearFormat === "YYYY") {
    parts.push(String(fullYear));
  } else if (yearFormat === "YY") {
    parts.push(String(fullYear).slice(-2));
  } else if (yearFormat === "YYYYMM") {
    parts.push(`${fullYear}${String(month).padStart(2, "0")}`);
  }

  const seqStr = String(Math.max(1, Math.floor(sequenceNumber))).padStart(digits, "0");
  parts.push(seqStr);

  return parts.join(delimiter);
}

/** Generates a human-readable token template representation, e.g. {PREFIX}-{YYYY}-{SEQ}. */
export function buildSequenceFormulaTemplate(
  config: Partial<SequenceNumberingConfig> = {},
): string {
  const delimiter = config.delimiter ?? "";
  const yearFormat: SequenceYearFormat = config.yearFormat ?? "YYYY";

  const tokens: string[] = ["{PREFIX}"];
  if (yearFormat !== "NONE") {
    tokens.push(`{${yearFormat}}`);
  }
  tokens.push("{SEQ}");

  return tokens.join(delimiter);
}

/** Formats a sequence ID using a tokenized template string (e.g. {seq}-{year}, {PREFIX}-{YYYY}-{SEQ}). */
export function formatTemplateSequence(
  template: string,
  sequenceNumber: number,
  digits = 4,
  dateInput?: Date | string,
  prefix = "",
): string {
  const parsedDate = dateInput
    ? dateInput instanceof Date
      ? dateInput
      : new Date(dateInput)
    : new Date();
  const validDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const fullYear = String(validDate.getFullYear());
  const shortYear = fullYear.slice(-2);
  const month = String(validDate.getMonth() + 1).padStart(2, "0");
  const safeDigits = Math.max(1, Math.min(8, Number(digits) || 4));
  const seqStr = String(Math.max(1, Math.floor(sequenceNumber))).padStart(safeDigits, "0");

  let result = template
    .replace(/\{seq\}/gi, seqStr)
    .replace(/\{year\}|\{yyyy\}/gi, fullYear)
    .replace(/\{yy\}/gi, shortYear)
    .replace(/\{mm\}/gi, month);

  if (prefix) {
    result = result.replace(/\{prefix\}/gi, prefix);
  }

  return result;
}

/** Escapes POSIX regex metacharacters so a literal segment can be embedded in a match pattern. */
const SEQUENCE_REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;
function escapeRegexLiteral(value: string): string {
  return value.replace(SEQUENCE_REGEX_ESCAPE, "\\$&");
}

/**
 * A sequence that restarts each period must print the period, or the second
 * period would reissue the first period's numbers.
 */
export function sequenceNumberingIsUnambiguous(
  config: Pick<SequenceNumberingConfig, "rolloverPolicy" | "yearFormat">,
): boolean {
  if (config.rolloverPolicy === "never") return true;
  if (config.rolloverPolicy === "monthly") return config.yearFormat === "YYYYMM";
  return config.yearFormat !== "NONE";
}

/** Counter identity: numbers in one format never share a counter with another format. */
export function sequenceFormatKey(
  config: Pick<SequenceNumberingConfig, "prefix" | "delimiter" | "yearFormat">,
): string {
  return `${config.yearFormat}|${config.delimiter}|${config.prefix}`;
}

/**
 * POSIX regex capturing the trailing sequence of numbers issued for one counter
 * period. `periodYear = 0` (never restarts) accepts any year segment.
 */
export function sequencePattern(
  config: Pick<SequenceNumberingConfig, "prefix" | "delimiter" | "yearFormat">,
  periodYear: number,
): string {
  const parts: string[] = [];
  if (config.prefix) parts.push(escapeRegexLiteral(config.prefix));
  if (config.yearFormat !== "NONE") {
    if (config.yearFormat === "YYYYMM") {
      parts.push(periodYear > 0 ? String(periodYear) : "\\d{6}");
    } else if (config.yearFormat === "YYYY") {
      parts.push(periodYear > 0 ? String(periodYear) : "\\d{4}");
    } else {
      parts.push(periodYear > 0 ? String(periodYear).slice(-2) : "\\d{2}");
    }
  }
  parts.push("(\\d{1,9})");
  return `^${parts.join(escapeRegexLiteral(config.delimiter))}$`;
}

/**
 * Formats a sequence number for one counter period through the shared engine, so
 * previews and issued numbers always agree. `printYear` is the period's printed
 * year (the counter period when numbering restarts, else the calendar year).
 */
export function formatSequenceNumber(
  sequence: number,
  config: Partial<SequenceNumberingConfig>,
  printYear: number,
  printMonth = 6,
): string {
  return formatDeterministicSequence(sequence, config, new Date(printYear, printMonth - 1, 15));
}

export * from "./sequenceNumberingAdapters.js";
