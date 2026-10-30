import { ApiError, parseRetryAfterSeconds } from "@/lib/apiError";

/**
 * Minimal structural view of a ts-rest response envelope. Both `@ts-rest/core`
 * and the hand-rolled contract helpers return `{ status, body, headers }`.
 */
export interface ContractResponse {
  status: number;
  /** Envelope body; optional so call sites that only hold a status still type-check. */
  body?: unknown;
  headers?: Headers | Record<string, string | undefined> | null;
}

/** `true` for 2xx — the only statuses a contract call may treat as success. */
export function isContractOk(status: number): boolean {
  return status >= 200 && status < 300;
}

function headerValue(response: ContractResponse, name: string): string | null {
  const { headers } = response;
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }
  const record = headers as Record<string, string | undefined>;
  return record[name] ?? record[name.toLowerCase()] ?? null;
}

function bodyRecord(body: unknown): Record<string, unknown> | null {
  return body !== null && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

/**
 * Builds the single `ApiError` every contract failure should throw.
 *
 * The ts-rest fetcher only throws for 401/403, so feature hooks inspect the
 * envelope themselves. Throwing a bare `Error` there loses the status (the query
 * client retried 4xx), `Retry-After` (rate-limit copy never rendered),
 * validation `errors` (field messages vanished) and `x-request-id` (Sentry had
 * no correlation). This helper keeps the body message when present and falls
 * back to the call site's contextual message.
 */
export function apiContractError(response: ContractResponse, fallbackMessage: string): ApiError {
  const body = bodyRecord(response.body);
  const bodyMessage = typeof body?.message === "string" ? body.message.trim() : "";
  const type = typeof body?.type === "string" ? body.type : undefined;
  const code = typeof body?.code === "string" ? body.code : undefined;
  const requestId = headerValue(response, "x-request-id") ?? undefined;
  const retryAfterSeconds = parseRetryAfterSeconds(headerValue(response, "retry-after"));

  return new ApiError(
    response.status,
    bodyMessage.length > 0 ? bodyMessage : fallbackMessage,
    type,
    requestId,
    body?.errors,
    retryAfterSeconds,
    code,
  );
}

/** Throws a fully-populated `ApiError` unless the contract response is 2xx. */
export function assertContractOk(response: ContractResponse, context: string): void {
  if (isContractOk(response.status)) return;
  throw apiContractError(response, context);
}

/**
 * `assertContractOk` for call sites whose helper returned the parsed body
 * (e.g. mutation wrappers that used to inline a returning `assertSuccess`).
 */
export function contractBodyOrThrow<T>(
  response: ContractResponse & { body: T },
  context: string,
): T {
  assertContractOk(response, context);
  return response.body;
}
