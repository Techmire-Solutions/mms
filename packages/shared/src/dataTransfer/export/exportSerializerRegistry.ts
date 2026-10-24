/**
 * @file exportSerializerRegistry.ts
 * @description Strategy pattern registry for export format serialisers.
 *
 * Usage:
 *   registerSerializer(csvSerializer);
 *   registerSerializer(jsonSerializer);
 *   const s = getSerializer('csv');
 *   const output = s.serialize(grid);
 */
import type { ExportFormat } from "../core/exportTypes.js";
import { UnknownFormatError } from "../core/transferErrors.js";

// ---------------------------------------------------------------------------
// Serialiser interface
// ---------------------------------------------------------------------------

/**
 * A format serialiser converts a 2D grid (header + rows) to a string payload
 * ready to write to a file or HTTP response body.
 *
 * **Sync contract:** serialisers receive an already-materialised grid.
 * For large payloads the streaming export path in
 * `csvExportStreamFactory.ts` is used instead — that path is CSV-only and
 * bypasses this registry.
 */
export interface ExportSerializer {
  readonly format: ExportFormat;
  readonly contentType: string;
  readonly fileExtension: string;
  serialize(grid: unknown[][]): string;
}

// ---------------------------------------------------------------------------
// Registry (module-level singleton)
// ---------------------------------------------------------------------------

const _registry = new Map<ExportFormat, ExportSerializer>();

/** Register a serialiser. Re-registration replaces the previous entry. */
export function registerSerializer(serializer: ExportSerializer): void {
  _registry.set(serializer.format, serializer);
}

/**
 * Retrieve a serialiser by format.
 * @throws {UnknownFormatError} when no serialiser has been registered.
 */
export function getSerializer(format: ExportFormat): ExportSerializer {
  const s = _registry.get(format);
  if (!s) throw new UnknownFormatError(format);
  return s;
}

/** Returns true if a serialiser is registered for the given format. */
export function hasSerializer(format: ExportFormat): boolean {
  return _registry.has(format);
}

/** All formats that have registered serialisers. */
export function registeredFormats(): ExportFormat[] {
  return Array.from(_registry.keys());
}
