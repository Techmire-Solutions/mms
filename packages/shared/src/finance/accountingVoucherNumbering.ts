import { z } from "zod";
import {
  sequenceRolloverPolicySchema,
  sequenceYearFormatSchema,
} from "../core/sequenceNumberingTypes.js";
import { formatDeterministicSequence } from "../core/sequenceNumberingUtils.js";
import { isoDateSchema } from "../core/isoDateSchema.js";

/** Alphanumeric only: the prefix is embedded in a server-side match pattern. */
export const VOUCHER_PREFIX_PATTERN = /^[A-Za-z0-9]{0,10}$/;
export const VOUCHER_DELIMITERS = ["", "-", "/", "."] as const;

const voucherNumberingFieldsSchema = z
  .object({
    autoGenerate: z.boolean(),
    prefix: z.string().trim().regex(VOUCHER_PREFIX_PATTERN),
    delimiter: z.enum(VOUCHER_DELIMITERS),
    yearFormat: sequenceYearFormatSchema,
    sequenceDigits: z.number().int().min(2).max(8),
    startingSequence: z.number().int().min(1).max(99_999_999),
    rolloverPolicy: sequenceRolloverPolicySchema,
  })
  .strict();

export type VoucherNumberingUpdate = z.infer<typeof voucherNumberingFieldsSchema>;

/**
 * A sequence that restarts each period must print the period, or the second
 * period would reissue the first period's references.
 */
export function voucherNumberingIsUnambiguous(
  config: Pick<VoucherNumberingUpdate, "rolloverPolicy" | "yearFormat">,
): boolean {
  return config.rolloverPolicy === "never" || config.yearFormat !== "NONE";
}

export const voucherNumberingUpdateSchema = voucherNumberingFieldsSchema.refine(
  voucherNumberingIsUnambiguous,
  {
    message: "Numbering that restarts every year must include the year",
    path: ["yearFormat"],
  },
);

export const voucherNumberingRecordSchema = voucherNumberingFieldsSchema
  .extend({
    /** Last number issued in the period that `nextVoucherNumber` belongs to. */
    currentSequence: z.number().int().min(0),
    /** Counter period of the preview: calendar or fiscal start year, `0` when numbering never restarts. */
    periodYear: z.number().int().min(0),
    /** Preview only — the number is assigned inside the save transaction. */
    nextVoucherNumber: z.string(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const voucherNumberingQuerySchema = z
  .object({
    date: isoDateSchema.optional(),
  })
  .strict();

export type VoucherNumbering = z.infer<typeof voucherNumberingRecordSchema>;

/** Matches the refs issued before configurable numbering (`JE-0001`). */
export const DEFAULT_VOUCHER_NUMBERING: VoucherNumberingUpdate = {
  autoGenerate: true,
  prefix: "JE",
  delimiter: "-",
  yearFormat: "NONE",
  sequenceDigits: 4,
  startingSequence: 1,
  rolloverPolicy: "never",
};

/** Calendar year of a `YYYY-MM-DD` voucher date. */
export function voucherCalendarYear(date: string | undefined, fallbackYear: number): number {
  const year = Number(date?.slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : fallbackYear;
}

/**
 * Formats with the shared sequence engine so previews and issued numbers agree.
 * `printYear` is the counter period when numbering restarts, else the voucher's calendar year.
 */
export function formatVoucherNumber(
  sequence: number,
  config: VoucherNumberingUpdate,
  printYear: number,
): string {
  return formatDeterministicSequence(sequence, config, new Date(printYear, 5, 15));
}

const escapeDelimiter = (delimiter: string): string =>
  delimiter.replace(/[./-]/g, (char) => `\\${char}`);

/**
 * POSIX regex capturing the sequence of refs issued for one counter period.
 * `periodYear = 0` (never restarts) accepts any year segment.
 */
export function voucherSequencePattern(config: VoucherNumberingUpdate, periodYear: number): string {
  const parts: string[] = [];
  if (config.prefix) parts.push(config.prefix);
  if (config.yearFormat !== "NONE") {
    const year = config.yearFormat === "YYYY" ? String(periodYear) : String(periodYear).slice(-2);
    parts.push(periodYear > 0 ? year : config.yearFormat === "YYYY" ? "\\d{4}" : "\\d{2}");
  }
  parts.push("(\\d{1,9})");
  return `^${parts.join(escapeDelimiter(config.delimiter))}$`;
}

/** Counter identity: numbers in one format never share a counter with another format. */
export function voucherFormatKey(
  config: Pick<VoucherNumberingUpdate, "prefix" | "delimiter" | "yearFormat">,
): string {
  return `${config.yearFormat}|${config.delimiter}|${config.prefix}`;
}
