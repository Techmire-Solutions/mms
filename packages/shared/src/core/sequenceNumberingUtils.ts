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

  const parts: string[] = [];
  if (prefix.length > 0) {
    parts.push(prefix);
  }

  if (yearFormat === "YYYY") {
    parts.push(String(fullYear));
  } else if (yearFormat === "YY") {
    parts.push(String(fullYear).slice(-2));
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

export * from "./sequenceNumberingAdapters.js";
