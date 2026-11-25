import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { parseOccHeaders, requireOccToken } from "../lib/occHeaders.js";
import { HttpDomainError, ValidationError } from "../lib/httpErrors.js";

function mockRequest(headers: Record<string, string | string[] | undefined>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

describe("occHeaders", () => {
  describe("parseOccHeaders", () => {
    it("returns empty object when no OCC headers are provided", () => {
      const req = mockRequest({});
      expect(parseOccHeaders(req)).toEqual({});
    });

    it("parses valid x-expected-version", () => {
      const req = mockRequest({ "x-expected-version": "3" });
      expect(parseOccHeaders(req)).toEqual({ expectedVersion: 3 });
    });

    it("parses array header for x-expected-version", () => {
      const req = mockRequest({ "x-expected-version": ["5", "6"] });
      expect(parseOccHeaders(req)).toEqual({ expectedVersion: 5 });
    });

    it("throws ValidationError for non-numeric version", () => {
      const req = mockRequest({ "x-expected-version": "abc" });
      expect(() => parseOccHeaders(req)).toThrow(ValidationError);
    });

    it("throws ValidationError for zero or negative version", () => {
      const req = mockRequest({ "x-expected-version": "0" });
      expect(() => parseOccHeaders(req)).toThrow(ValidationError);
    });

    it("parses valid UTC ISO x-expected-updated-at", () => {
      const req = mockRequest({ "x-expected-updated-at": "2026-03-01T10:00:00.000Z" });
      expect(parseOccHeaders(req)).toEqual({ expectedUpdatedAt: "2026-03-01T10:00:00.000Z" });
    });

    it("throws ValidationError for non-UTC or malformed timestamp", () => {
      const req = mockRequest({ "x-expected-updated-at": "2026-03-01 10:00:00" });
      expect(() => parseOccHeaders(req)).toThrow(ValidationError);
    });

    it("parses both version and updated-at together", () => {
      const req = mockRequest({
        "x-expected-version": "2",
        "x-expected-updated-at": "2026-03-01T12:00:00Z",
      });
      expect(parseOccHeaders(req)).toEqual({
        expectedVersion: 2,
        expectedUpdatedAt: "2026-03-01T12:00:00Z",
      });
    });
  });

  describe("requireOccToken", () => {
    it("passes when expectedVersion is present", () => {
      expect(() => requireOccToken({ expectedVersion: 1 })).not.toThrow();
    });

    it("passes when expectedUpdatedAt is present", () => {
      expect(() =>
        requireOccToken({ expectedUpdatedAt: "2026-03-01T10:00:00.000Z" }),
      ).not.toThrow();
    });

    it("throws HttpDomainError with 428 precondition_required when both are missing", () => {
      expect(() => requireOccToken({})).toThrow(HttpDomainError);
      try {
        requireOccToken({});
      } catch (err) {
        expect((err as HttpDomainError).statusCode).toBe(428);
        expect((err as HttpDomainError).type).toBe("precondition_required");
      }
    });
  });
});
