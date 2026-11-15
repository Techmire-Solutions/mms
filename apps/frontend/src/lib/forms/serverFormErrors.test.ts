import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/apiError";
import { mapApiFormError } from "./serverFormErrors";

describe("mapApiFormError", () => {
  it("maps a flat errors object", () => {
    const error = new ApiError(422, "Validation failed", "validation", undefined, {
      email: "Email is taken",
      name: ["Name is required"],
    });

    expect(mapApiFormError(error)).toEqual({
      fieldErrors: { email: "Email is taken", name: "Name is required" },
      message: "Validation failed",
      isConflict: false,
      isApiError: true,
    });
  });

  it("maps a fieldErrors wrapper and strips a body. prefix", () => {
    const error = new ApiError(400, "Invalid", "validation", undefined, {
      fieldErrors: {
        "body.studentId": "Student is required",
        accountId: "Account is required",
      },
    });

    expect(mapApiFormError(error).fieldErrors).toEqual({
      studentId: "Student is required",
      accountId: "Account is required",
    });
  });

  it("maps an array payload keyed by path", () => {
    const error = new ApiError(422, "Invalid", "validation", undefined, [
      { path: ["lines", 0, "amount"], message: "Amount must be positive" },
      { field: "accountId", message: "Account is required" },
    ]);

    expect(mapApiFormError(error).fieldErrors).toEqual({
      "lines.0.amount": "Amount must be positive",
      accountId: "Account is required",
    });
  });

  it("maps details.fieldErrors when the top-level errors payload is empty", () => {
    const error = new ApiError(
      409,
      "Conflict",
      "conflict",
      undefined,
      undefined,
      undefined,
      undefined,
      {
        fieldErrors: { updatedAt: "Record changed" },
      },
    );

    const mapped = mapApiFormError(error);
    expect(mapped.fieldErrors).toEqual({ updatedAt: "Record changed" });
    expect(mapped.isConflict).toBe(true);
  });

  it("does not turn arbitrary domain details into field errors", () => {
    const error = new ApiError(
      422,
      "Illegal transition",
      "domain",
      undefined,
      undefined,
      undefined,
      undefined,
      {
        from: "draft",
        to: "closed",
      },
    );

    const mapped = mapApiFormError(error);
    expect(mapped.fieldErrors).toBeUndefined();
    expect(mapped.message).toBe("Illegal transition");
  });

  it("translates field messages and the form message", () => {
    const error = new ApiError(422, "validation.failed", "validation", undefined, {
      email: "validation.email",
    });

    expect(mapApiFormError(error, (message) => `t:${message}`)).toMatchObject({
      fieldErrors: { email: "t:validation.email" },
      message: "t:validation.failed",
    });
  });

  it("falls back to a thrown Error's message for non-API failures", () => {
    expect(mapApiFormError(new Error("Network down"))).toEqual({
      message: "Network down",
      isConflict: false,
      isApiError: false,
    });
  });

  it("returns no fields for an API failure without a validation payload", () => {
    const mapped = mapApiFormError(new ApiError(500, "Server exploded", "internal"));
    expect(mapped).toEqual({
      message: "Server exploded",
      isConflict: false,
      isApiError: true,
    });
  });
});
