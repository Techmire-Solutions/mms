/**
 * @file transferErrors.ts
 * @description Typed error hierarchy for the data-transfer pipeline.
 *
 * Prefer throwing these rather than plain `Error` so callers can
 * discriminate on `code` without string-matching `.message`.
 */

/** Base class for all data-transfer pipeline errors. */
export class DataTransferError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DataTransferError";
  }
}

/**
 * Thrown when a buffered export would exceed the memory-safe byte or
 * record cap. Callers should retry using the streaming path.
 */
export class ExportLimitError extends DataTransferError {
  constructor(message: string) {
    super(message, "EXPORT_LIMIT_EXCEEDED");
    this.name = "ExportLimitError";
  }
}

/**
 * Thrown when **all** rows in an import batch fail validation and the
 * caller elects to treat that as a hard failure.
 *
 * The pipeline itself never throws this — individual row errors are
 * collected and returned in `ImportResult.errors`.
 */
export class ImportValidationError extends DataTransferError {
  constructor(
    message: string,
    public readonly rowErrors: ReadonlyArray<{ row: number; reason: string }>,
  ) {
    super(message, "IMPORT_VALIDATION_FAILED");
    this.name = "ImportValidationError";
  }
}

/** Thrown when a requested export format has no registered serialiser. */
export class UnknownFormatError extends DataTransferError {
  constructor(format: string) {
    super(`No serialiser registered for export format "${format}"`, "UNKNOWN_EXPORT_FORMAT");
    this.name = "UnknownFormatError";
  }
}
