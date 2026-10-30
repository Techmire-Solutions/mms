import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/apiError";
import {
  apiContractError,
  assertContractOk,
  contractBodyOrThrow,
  isContractOk,
} from "./apiContractError";

function errorOf(run: () => void): ApiError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error("expected the call to throw");
}

describe("isContractOk", () => {
  it("given 2xx statuses, should treat them as success when checked", () => {
    expect(isContractOk(200)).toBe(true);
    expect(isContractOk(201)).toBe(true);
    expect(isContractOk(299)).toBe(true);
  });

  it("given non-2xx statuses, should treat them as failures when checked", () => {
    for (const status of [199, 300, 400, 401, 404, 422, 429, 500, 503]) {
      expect(isContractOk(status)).toBe(false);
    }
  });
});

describe("apiContractError", () => {
  it("given a JSON error body with headers, should carry the structured fields when built", () => {
    // Arrange
    const headers = new Headers({ "x-request-id": "req-1", "retry-after": "12" });
    const errors = [{ fieldId: "email", message: "Email is already used" }];

    // Act
    const error = apiContractError(
      {
        status: 409,
        body: {
          message: "Duplicate contact",
          type: "validation_error",
          code: "contact_unique",
          errors,
        },
        headers,
      },
      "fallback message",
    );

    // Assert
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe("Duplicate contact");
    expect(error.type).toBe("validation_error");
    expect(error.code).toBe("contact_unique");
    expect(error.errors).toEqual(errors);
    expect(error.requestId).toBe("req-1");
    expect(error.retryAfterSeconds).toBe(12);
  });

  it("given a non-object body, should fall back to the context message when built", () => {
    // Act
    const error = apiContractError({ status: 502, body: "<html>Bad Gateway</html>" }, "failing");

    // Assert
    expect(error.message).toBe("failing");
    expect(error.type).toBe("request_failed");
    expect(error.requestId).toBeUndefined();
    expect(error.retryAfterSeconds).toBeUndefined();
  });

  it("given an empty body message, should fall back to the context message when built", () => {
    const error = apiContractError({ status: 500, body: { message: "   " } }, "server failed");
    expect(error.message).toBe("server failed");
  });

  it("given plain-object headers, should read request id and Retry-After when built", () => {
    const error = apiContractError(
      {
        status: 429,
        body: { message: "slow down" },
        headers: { "retry-after": "7", "x-request-id": "rid-2" },
      },
      "fallback",
    );
    expect(error.retryAfterSeconds).toBe(7);
    expect(error.requestId).toBe("rid-2");
  });

  it("given an HTTP-date Retry-After, should compute a positive wait when built", () => {
    // Arrange
    const retryAt = new Date(Date.now() + 10_000).toUTCString();

    // Act
    const error = apiContractError(
      { status: 503, body: {}, headers: new Headers({ "retry-after": retryAt }) },
      "unavailable",
    );

    // Assert
    expect(error.retryAfterSeconds).toBeGreaterThanOrEqual(8);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(10);
  });

  it("given validation errors only, should preserve them when built", () => {
    const errors = [{ fieldId: "name", message: "Required" }];
    const error = apiContractError({ status: 400, body: { errors } }, "invalid");
    expect(error.errors).toEqual(errors);
    expect(error.message).toBe("invalid");
  });
});

describe("assertContractOk", () => {
  it("given a 2xx response, should not throw when asserted", () => {
    expect(() => assertContractOk({ status: 200, body: {} }, "ok")).not.toThrow();
    expect(() => assertContractOk({ status: 204, body: null }, "ok")).not.toThrow();
  });

  it("given a returning helper, should return the parsed body on success and throw on failure", () => {
    // Act / Assert
    expect(contractBodyOrThrow({ status: 200, body: { total: 3 } }, "load failed")).toEqual({
      total: 3,
    });
    const error = errorOf(() =>
      contractBodyOrThrow({ status: 500, body: { message: "boom" } }, "load failed"),
    );
    expect(error.status).toBe(500);
    expect(error.message).toBe("boom");
  });

  it("given a non-2xx response, should throw an ApiError with the body message when asserted", () => {
    // Act
    const error = errorOf(() =>
      assertContractOk({ status: 404, body: { message: "Student not found" } }, "load failed"),
    );

    // Assert
    expect(error.status).toBe(404);
    expect(error.message).toBe("Student not found");
  });
});
