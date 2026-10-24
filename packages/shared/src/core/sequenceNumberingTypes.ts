import { z } from "zod";

export const sequenceYearFormatSchema = z.enum(["YYYY", "YY", "NONE"]);
export type SequenceYearFormat = z.infer<typeof sequenceYearFormatSchema>;

export const sequenceRolloverPolicySchema = z.enum(["annual_calendar", "annual_fiscal", "never"]);
export type SequenceRolloverPolicy = z.infer<typeof sequenceRolloverPolicySchema>;

export const sequenceNumberingConfigSchema = z
  .object({
    autoGenerate: z.boolean().default(true),
    prefix: z.string().trim().max(10).default(""),
    yearFormat: sequenceYearFormatSchema.default("YYYY"),
    sequenceDigits: z.number().int().min(2).max(8).default(4),
    delimiter: z.string().max(3).default(""),
    startingSequence: z.number().int().min(1).default(1),
    rolloverPolicy: sequenceRolloverPolicySchema.default("annual_calendar"),
    currentSequence: z.number().int().min(0).optional().default(0),
    lastRolloverYear: z.number().int().optional(),
  })
  .strict();

export type SequenceNumberingConfig = z.infer<typeof sequenceNumberingConfigSchema>;

export const SEQUENCE_DELIMITER_PRESETS = [
  { label: "None", value: "" },
  { label: "Hyphen (-)", value: "-" },
  { label: "Slash (/)", value: "/" },
  { label: "Dot (.)", value: "." },
] as const;
