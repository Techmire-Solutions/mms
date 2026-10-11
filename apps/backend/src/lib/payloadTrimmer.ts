/**
 * Strips undefined properties recursively from objects and arrays.
 * Preserves explicit nulls (required for schema backwards-compatibility), primitives,
 * Dates, Buffers, and standard class instances.
 */
export function stripUndefinedFields<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return (value as unknown[]).map((item) => stripUndefinedFields(item)) as T;
  }
  if (typeof value === "object") {
    if (value instanceof Date || Buffer.isBuffer(value) || value instanceof RegExp) {
      return value;
    }
    // Only strip plain JS objects
    if (value.constructor === Object || !value.constructor) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        if (v !== undefined) {
          result[k] = stripUndefinedFields(v);
        }
      }
      return result as T;
    }
  }
  return value;
}
