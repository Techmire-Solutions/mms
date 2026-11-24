/**
 * Readable message for a failed API call.
 *
 * `ts-rest` rejects with a plain `{ status, body }` object rather than an
 * `Error`, so passing it through `String()` yields `[object Object]` and the
 * server's explanation never reaches the user. This reads the standard error
 * envelope first, then falls back to anything message-shaped.
 */
export function apiErrorMessage(error: unknown, fallback = ""): string {
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object" && error !== null) {
    const body = (error as { body?: unknown }).body;
    if (typeof body === "string" && body.trim()) return body;
    if (typeof body === "object" && body !== null) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}
