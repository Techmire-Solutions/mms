/**
 * Typed IAM failures. The backend routers map `code` to the HTTP status; the
 * policy layer and service throw these so authorization failures are never
 * inferred from message substrings.
 */
export type IamErrorCode = "bad_request" | "unauthorized" | "forbidden" | "not_found" | "conflict";

export class IamError extends Error {
  readonly code: IamErrorCode;

  constructor(code: IamErrorCode, message: string) {
    super(message);
    this.name = "IamError";
    this.code = code;
  }
}

export function isIamError(error: unknown): error is IamError {
  return error instanceof IamError;
}
