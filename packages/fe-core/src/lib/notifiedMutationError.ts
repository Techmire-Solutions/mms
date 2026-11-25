/**
 * Marker error thrown after a mutation failure has already been surfaced via `notify`.
 * Form/page catch blocks can skip a second toast when they see this type.
 */
export class NotifiedMutationError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NotifiedMutationError";
  }
}

export function isNotifiedMutationError(error: unknown): error is NotifiedMutationError {
  return error instanceof NotifiedMutationError;
}
