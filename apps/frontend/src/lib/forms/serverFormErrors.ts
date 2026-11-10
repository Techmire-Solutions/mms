import { isApiError } from "@/lib/apiError";

/** Maps common API validation error payloads to field → message entries. */
export function mapApiFormError(error: unknown): {
  fieldErrors?: Record<string, string>;
  message?: string;
} {
  if (!isApiError(error)) return {};
  const raw = error.errors;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    const source =
      record.fieldErrors && typeof record.fieldErrors === "object"
        ? (record.fieldErrors as Record<string, unknown>)
        : record;
    const fieldErrors: Record<string, string> = {};
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === "string") fieldErrors[key] = value;
      else if (Array.isArray(value) && typeof value[0] === "string")
        fieldErrors[key] = String(value[0]);
    }
    if (Object.keys(fieldErrors).length > 0) return { fieldErrors, message: error.message };
  }
  if (Array.isArray(raw)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const entry = item as { field?: unknown; path?: unknown; message?: unknown };
      const field = typeof entry.field === "string" ? entry.field : String(entry.path ?? []);
      if (field && typeof entry.message === "string") fieldErrors[field] = entry.message;
    }
    if (Object.keys(fieldErrors).length > 0) return { fieldErrors, message: error.message };
  }
  return { message: error.message };
}
