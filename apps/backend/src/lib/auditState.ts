import type { AuditActionType } from "@mms/shared";

/**
 * Maps an action string to a canonical `AuditActionType`.
 */
export function mapActionStringToAuditType(action: string): AuditActionType {
  const lower = action.toLowerCase();
  if (lower.includes("create") || lower.includes("add") || lower.includes("insert"))
    return "CREATE";
  if (
    lower.includes("delete") ||
    lower.includes("remove") ||
    lower.includes("purge") ||
    lower.includes("archive")
  )
    return "DELETE";
  if (lower.includes("login") || lower.includes("auth")) return "LOGIN";
  if (lower.includes("restore")) return "RESTORE";
  if (lower.includes("view") || lower.includes("read") || lower.includes("export")) return "VIEW";
  if (lower.includes("redact")) return "REDACT";
  return "UPDATE";
}

/** Fields to automatically strip at capture time to minimize PII and avoid secret leakage. */
const REDACTED_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "salt",
  "secret",
  "token",
  "refreshToken",
  "refresh_token",
  "jwt",
  "apiKey",
  "api_key",
]);

/**
 * Minimizes state payloads at capture time: strips credentials and unneeded heavy secrets.
 */
export function sanitizeAuditState(state: unknown): unknown {
  if (state === null || typeof state !== "object") {
    return state;
  }
  if (Array.isArray(state)) {
    return state.map(sanitizeAuditState);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key)) {
      sanitized[key] = "[REDACTED_SECRET]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeAuditState(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
