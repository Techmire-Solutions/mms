import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/apiClient";
import { getApiValidationErrors, getApiValidationMessage } from "@/lib/apiValidationMessage";

describe("getApiValidationMessage", () => {
  it("returns first field error message when present", () => {
    const error = new ApiError(400, "Invalid request", "validation_error", undefined, [
      { fieldId: "number", tabId: "phones", message: "Phone Number must be unique" },
    ]);
    expect(getApiValidationMessage(error)).toBe("Phone Number must be unique");
    expect(getApiValidationErrors(error)?.[0]?.fieldId).toBe("number");
  });

  it("falls back to ApiError.message for validation_error without field list", () => {
    const error = new ApiError(400, "Bad payload", "validation_error");
    expect(getApiValidationMessage(error)).toBe("Bad payload");
  });

  it("returns undefined for non-validation errors", () => {
    expect(getApiValidationMessage(new ApiError(500, "boom", "server_error"))).toBeUndefined();
    expect(getApiValidationMessage(new Error("nope"))).toBeUndefined();
  });
});
