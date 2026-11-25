/**
 * Errors thrown by the data layer.
 *
 * `dbPoolMetrics` raises "service unavailable" when the pool (or a tenant's
 * transaction budget) is exhausted. The backend maps its own
 * `ServiceUnavailableError` to HTTP 503, so the app registers an error factory at
 * boot (`setServiceUnavailableErrorFactory`) and keeps a single error identity in
 * the API process. Without registration the package throws its own class carrying
 * the same `statusCode`/`type`, so callers can still classify it.
 */
export class ServiceUnavailableError extends Error {
  readonly statusCode = 503;
  readonly type = "service_unavailable";

  constructor(message = "Service unavailable") {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}

export type ServiceUnavailableErrorFactory = (message?: string) => Error;

let factory: ServiceUnavailableErrorFactory = (message) => new ServiceUnavailableError(message);

/** Register the application's 503 error class. */
export function setServiceUnavailableErrorFactory(next: ServiceUnavailableErrorFactory): void {
  factory = next;
}

/** Restore the package default error class (tests only). */
export function resetServiceUnavailableErrorFactoryForTesting(): void {
  factory = (message) => new ServiceUnavailableError(message);
}

export function createServiceUnavailableError(message?: string): Error {
  return factory(message);
}
