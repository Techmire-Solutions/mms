import type { FastifyRequest } from "fastify";
import { HttpDomainError, ValidationError } from "./httpErrors.js";

const VERSION_SHAPE = /^\d+$/;
/** UTC ISO-8601 timestamps only: an offset-less value would be parsed in the server's timezone. */
const ISO_UTC_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** Shared predicate so routes and use-cases agree on what a valid OCC timestamp is. */
export function isIsoUtcTimestamp(value: string): boolean {
  return ISO_UTC_SHAPE.test(value.trim());
}

export interface OccToken {
  expectedVersion?: number;
  expectedUpdatedAt?: string;
}

/**
 * Parses the optimistic-concurrency headers at the HTTP boundary. Malformed values are a 400;
 * the "no token" case is left to the 428 guard in the use-cases so payload validation runs first.
 */
export function parseOccHeaders(request: FastifyRequest): OccToken {
  const versionHeader = request.headers["x-expected-version"];
  const rawVersion = Array.isArray(versionHeader) ? versionHeader[0] : versionHeader;
  const updatedHeader = request.headers["x-expected-updated-at"];
  const rawUpdated = Array.isArray(updatedHeader) ? updatedHeader[0] : updatedHeader;

  let expectedVersion: number | undefined;
  if (rawVersion !== undefined && rawVersion.trim() !== "") {
    if (!VERSION_SHAPE.test(rawVersion.trim()))
      throw new ValidationError("x-expected-version must be a positive integer");
    expectedVersion = Number(rawVersion);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
      throw new ValidationError("x-expected-version must be a positive integer");
  }

  const expectedUpdatedAt = rawUpdated?.trim();
  if (expectedUpdatedAt && !isIsoUtcTimestamp(expectedUpdatedAt))
    throw new ValidationError(
      "x-expected-updated-at must be an ISO-8601 UTC timestamp (for example 2026-03-01T10:00:00.000Z)",
    );

  return {
    ...(expectedVersion !== undefined ? { expectedVersion } : {}),
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  };
}

/** Conditional writes require a token; without one the caller must reload first. */
export function requireOccToken(token: OccToken): void {
  if (token.expectedVersion === undefined && !token.expectedUpdatedAt)
    throw new HttpDomainError(
      428,
      "precondition_required",
      "Send x-expected-version (or x-expected-updated-at) with the value you read before saving",
    );
}
