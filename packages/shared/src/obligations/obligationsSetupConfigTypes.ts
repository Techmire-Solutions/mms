import { z } from "zod";
import {
  sequenceYearFormatSchema,
  sequenceRolloverPolicySchema,
  type SequenceYearFormat,
  type SequenceRolloverPolicy,
} from "../core/sequenceNumberingTypes.js";
import {
  DEFAULT_OBLIGATIONS_SETTINGS,
  type ObligationsSettings,
} from "./obligationsModuleSettings.js";

/** PUT /api/obligations/preferences — obligations prefs only. */
export const obligationsPreferencesPutBodySchema = z
  .object({
    autoGenerateReceipt: z.boolean().optional(),
    receiptPrefix: z.string().trim().max(10).optional(),
    receiptYearFormat: sequenceYearFormatSchema.optional(),
    receiptSequenceDigits: z.number().int().min(2).max(8).optional(),
    receiptDelimiter: z.string().max(3).optional(),
    receiptStartingSequence: z.number().int().min(1).optional(),
    receiptRolloverPolicy: sequenceRolloverPolicySchema.optional(),
    receiptCurrentSequence: z.number().int().min(0).optional(),
    defaultViewLayout: z.string().optional(),
  })
  .passthrough();

export const obligationsPreferencesResponseSchema = z.object({
  autoGenerateReceipt: z.boolean(),
  receiptPrefix: z.string(),
  receiptYearFormat: sequenceYearFormatSchema,
  receiptSequenceDigits: z.number(),
  receiptDelimiter: z.string(),
  receiptStartingSequence: z.number(),
  receiptRolloverPolicy: sequenceRolloverPolicySchema,
  receiptCurrentSequence: z.number().optional(),
  defaultViewLayout: z.string(),
});

/** Typed preference state for Obligations module. */
export interface ObligationsModulePreferences {
  autoGenerateReceipt: boolean;
  receiptPrefix: string;
  receiptYearFormat: SequenceYearFormat;
  receiptSequenceDigits: number;
  receiptDelimiter: string;
  receiptStartingSequence: number;
  receiptRolloverPolicy: SequenceRolloverPolicy;
  receiptCurrentSequence?: number;
  defaultViewLayout: string;
}

/** Extracts preferences slice from a raw composed settings blob. */
export function normalizeObligationsModulePreferences(raw: unknown): ObligationsModulePreferences {
  if (!raw || typeof raw !== "object") {
    return {
      autoGenerateReceipt: DEFAULT_OBLIGATIONS_SETTINGS.autoGenerateReceipt ?? true,
      receiptPrefix: DEFAULT_OBLIGATIONS_SETTINGS.receiptPrefix ?? "OBL",
      receiptYearFormat: DEFAULT_OBLIGATIONS_SETTINGS.receiptYearFormat ?? "YYYY",
      receiptSequenceDigits: DEFAULT_OBLIGATIONS_SETTINGS.receiptSequenceDigits ?? 5,
      receiptDelimiter: DEFAULT_OBLIGATIONS_SETTINGS.receiptDelimiter ?? "-",
      receiptStartingSequence: DEFAULT_OBLIGATIONS_SETTINGS.receiptStartingSequence ?? 1,
      receiptRolloverPolicy: DEFAULT_OBLIGATIONS_SETTINGS.receiptRolloverPolicy ?? "annual_calendar",
      receiptCurrentSequence: DEFAULT_OBLIGATIONS_SETTINGS.receiptCurrentSequence,
      defaultViewLayout: DEFAULT_OBLIGATIONS_SETTINGS.defaultViewLayout || "list",
    };
  }

  const prefs = raw as Partial<ObligationsModulePreferences>;
  return {
    autoGenerateReceipt:
      typeof prefs.autoGenerateReceipt === "boolean"
        ? prefs.autoGenerateReceipt
        : (DEFAULT_OBLIGATIONS_SETTINGS.autoGenerateReceipt ?? true),
    receiptPrefix:
      typeof prefs.receiptPrefix === "string"
        ? prefs.receiptPrefix
        : (DEFAULT_OBLIGATIONS_SETTINGS.receiptPrefix ?? "OBL"),
    receiptYearFormat:
      prefs.receiptYearFormat === "YYYY" || prefs.receiptYearFormat === "YY" || prefs.receiptYearFormat === "NONE"
        ? prefs.receiptYearFormat
        : (DEFAULT_OBLIGATIONS_SETTINGS.receiptYearFormat ?? "YYYY"),
    receiptSequenceDigits:
      typeof prefs.receiptSequenceDigits === "number"
        ? prefs.receiptSequenceDigits
        : (DEFAULT_OBLIGATIONS_SETTINGS.receiptSequenceDigits ?? 5),
    receiptDelimiter:
      typeof prefs.receiptDelimiter === "string"
        ? prefs.receiptDelimiter
        : (DEFAULT_OBLIGATIONS_SETTINGS.receiptDelimiter ?? "-"),
    receiptStartingSequence:
      typeof prefs.receiptStartingSequence === "number"
        ? prefs.receiptStartingSequence
        : (DEFAULT_OBLIGATIONS_SETTINGS.receiptStartingSequence ?? 1),
    receiptRolloverPolicy:
      prefs.receiptRolloverPolicy === "annual_calendar" ||
      prefs.receiptRolloverPolicy === "annual_fiscal" ||
      prefs.receiptRolloverPolicy === "never"
        ? prefs.receiptRolloverPolicy
        : (DEFAULT_OBLIGATIONS_SETTINGS.receiptRolloverPolicy ?? "annual_calendar"),
    receiptCurrentSequence:
      typeof prefs.receiptCurrentSequence === "number"
        ? prefs.receiptCurrentSequence
        : DEFAULT_OBLIGATIONS_SETTINGS.receiptCurrentSequence,
    defaultViewLayout:
      typeof prefs.defaultViewLayout === "string"
        ? prefs.defaultViewLayout
        : (DEFAULT_OBLIGATIONS_SETTINGS.defaultViewLayout || "list"),
  };
}

/** Composes full ObligationsSettings from raw preferences blob. */
export function normalizeObligationsSettings(raw: unknown): ObligationsSettings {
  return normalizeObligationsModulePreferences(raw);
}
