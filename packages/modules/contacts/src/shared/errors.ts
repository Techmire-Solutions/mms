/**
 * Typed contacts failures. The backend routers map `code` to the HTTP status;
 * the service layer throws these so authorization/not-found failures are never
 * inferred from message substrings.
 */
export type ContactsErrorCode =
  "bad_request" | "unauthorized" | "forbidden" | "not_found" | "conflict";

export class ContactsError extends Error {
  readonly code: ContactsErrorCode;

  constructor(code: ContactsErrorCode, message: string) {
    super(message);
    this.name = "ContactsError";
    this.code = code;
  }
}

export function isContactsError(error: unknown): error is ContactsError {
  return error instanceof ContactsError;
}
