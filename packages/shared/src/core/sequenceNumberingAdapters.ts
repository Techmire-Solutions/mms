import type {
  SequenceNumberingConfig,
  SequenceYearFormat,
  SequenceRolloverPolicy,
} from "./sequenceNumberingTypes.js";
import type { ObligationsSettings } from "../obligations/obligationsModuleSettings.js";

/** Adapts Faculty/Teachers settings to a standard SequenceNumberingConfig. */
export function facultySettingsToSequenceConfig(settings: {
  autoGenerateId?: boolean;
  employeeIdPrefix?: string;
  idPrefix?: string;
  employeeIdYearFormat?: "YYYY" | "YY";
  employeeIdSequenceDigits?: number;
  idDigits?: number;
  employeeIdDelimiter?: string;
  idStartSeq?: number;
  idRestartAnnually?: boolean;
  employeeIdCurrentSequence?: number;
  employeeIdLastYear?: number;
}): SequenceNumberingConfig {
  const prefix = settings.employeeIdPrefix ?? settings.idPrefix ?? "FAC";
  const yearFormat = (settings.employeeIdYearFormat ?? "YYYY") as SequenceYearFormat;
  const sequenceDigits = settings.employeeIdSequenceDigits ?? settings.idDigits ?? 4;
  const delimiter = settings.employeeIdDelimiter ?? "";
  const startingSequence = settings.idStartSeq ?? 1;
  const rolloverPolicy: SequenceRolloverPolicy =
    settings.idRestartAnnually === false ? "never" : "annual_calendar";

  return {
    autoGenerate: settings.autoGenerateId !== false,
    prefix,
    yearFormat,
    sequenceDigits,
    delimiter,
    startingSequence,
    rolloverPolicy,
    currentSequence: settings.employeeIdCurrentSequence ?? 0,
    lastRolloverYear: settings.employeeIdLastYear,
  };
}

/** Adapts Students settings to a standard SequenceNumberingConfig with backward-compatibility. */
export function studentSettingsToSequenceConfig(settings: {
  autoGenerateId?: boolean;
  grNumberTemplate?: string;
  grNumberDigits?: number;
  grNumberRestartAnnually?: boolean;
  grNumberPrefix?: string;
  grNumberYearFormat?: SequenceYearFormat;
  grNumberDelimiter?: string;
  grNumberStartingSequence?: number;
  grNumberStartSeq?: number;
  grNumberRolloverPolicy?: SequenceRolloverPolicy;
  grNumberCurrentSequence?: number;
  grNumberCurrentSeq?: number;
}): SequenceNumberingConfig {
  let prefix = settings.grNumberPrefix ?? "GR";
  let yearFormat: SequenceYearFormat = settings.grNumberYearFormat ?? "YY";
  let delimiter = settings.grNumberDelimiter ?? "";

  if (settings.grNumberTemplate && !settings.grNumberPrefix) {
    const tmpl = settings.grNumberTemplate;
    if (tmpl.includes("-")) delimiter = "-";
    else if (tmpl.includes("/")) delimiter = "/";

    if (tmpl.includes("{YYYY}") || tmpl.includes("{yyyy}")) {
      yearFormat = "YYYY";
    } else if (tmpl.includes("{YY}") || tmpl.includes("{yy}")) {
      yearFormat = "YY";
    } else if (!tmpl.toLowerCase().includes("year") && !tmpl.toLowerCase().includes("yy")) {
      yearFormat = "NONE";
    }

    const firstSegment = tmpl.split(/[-/]/)[0];
    if (firstSegment && !firstSegment.includes("{")) {
      prefix = firstSegment;
    }
  }

  const sequenceDigits = Math.max(2, Math.min(8, Number(settings.grNumberDigits) || 4));
  const startingSequence = settings.grNumberStartingSequence ?? settings.grNumberStartSeq ?? 1;
  const rolloverPolicy: SequenceRolloverPolicy =
    settings.grNumberRolloverPolicy ??
    (settings.grNumberRestartAnnually === false ? "never" : "annual_calendar");

  return {
    autoGenerate: settings.autoGenerateId !== false,
    prefix,
    yearFormat,
    sequenceDigits,
    delimiter,
    startingSequence,
    rolloverPolicy,
    currentSequence: settings.grNumberCurrentSequence ?? settings.grNumberCurrentSeq ?? 0,
  };
}

/** Adapts Accounting settings to a standard SequenceNumberingConfig. */
export function accountingSettingsToSequenceConfig(settings: {
  journalAutoGenerateRef?: boolean;
  journalRefPrefix?: string;
  journalRefYearFormat?: SequenceYearFormat;
  journalRefSequenceDigits?: number;
  journalRefDelimiter?: string;
  journalRefStartingSequence?: number;
  journalRefRolloverPolicy?: SequenceRolloverPolicy;
  journalRefCurrentSequence?: number;
}): SequenceNumberingConfig {
  return {
    autoGenerate: settings.journalAutoGenerateRef !== false,
    prefix: settings.journalRefPrefix ?? "JE",
    yearFormat: settings.journalRefYearFormat ?? "NONE",
    sequenceDigits: settings.journalRefSequenceDigits ?? 4,
    delimiter: settings.journalRefDelimiter ?? "-",
    startingSequence: settings.journalRefStartingSequence ?? 1,
    rolloverPolicy: settings.journalRefRolloverPolicy ?? "annual_fiscal",
    currentSequence: settings.journalRefCurrentSequence ?? 0,
  };
}

/** Adapts Finance settings to a standard SequenceNumberingConfig. */
export function financeSettingsToSequenceConfig(settings: {
  autoGenerateInvoice?: boolean;
  invoicePrefix?: string;
  invoiceYearFormat?: SequenceYearFormat;
  invoiceSequenceDigits?: number;
  invoiceDelimiter?: string;
  invoiceStartingSequence?: number;
  invoiceRolloverPolicy?: SequenceRolloverPolicy;
  invoiceCurrentSequence?: number;
}): SequenceNumberingConfig {
  return {
    autoGenerate: settings.autoGenerateInvoice !== false,
    prefix: settings.invoicePrefix ?? "INV",
    yearFormat: settings.invoiceYearFormat ?? "YYYY",
    sequenceDigits: settings.invoiceSequenceDigits ?? 4,
    delimiter: settings.invoiceDelimiter ?? "-",
    startingSequence: settings.invoiceStartingSequence ?? 1,
    rolloverPolicy: settings.invoiceRolloverPolicy ?? "annual_calendar",
    currentSequence: settings.invoiceCurrentSequence ?? 0,
  };
}

/** Adapts Obligations settings to a standard SequenceNumberingConfig. */
export function obligationsSettingsToSequenceConfig(
  settings: Partial<ObligationsSettings> = {},
): SequenceNumberingConfig {
  const digits = Math.max(2, Math.min(8, Number(settings.receiptSequenceDigits) || 5));
  const delimiter = settings.receiptDelimiter ?? "-";
  return {
    autoGenerate: settings.autoGenerateReceipt !== false,
    prefix: settings.receiptPrefix ?? "OBL",
    yearFormat: settings.receiptYearFormat ?? "YYYY",
    sequenceDigits: digits,
    delimiter,
    startingSequence: Number(settings.receiptStartingSequence) || 1,
    rolloverPolicy: settings.receiptRolloverPolicy ?? "annual_calendar",
    currentSequence: Number(settings.receiptCurrentSequence) || 0,
  };
}
