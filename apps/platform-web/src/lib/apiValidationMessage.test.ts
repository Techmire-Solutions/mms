import { describe, expect, it } from "vitest";
import { ApiError } from "@mms/fe-core/api/client";
import {
  getApiValidationErrors,
  getApiValidationMessage,
} from "@mms/fe-core/api/validationMessage";

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

  it("parses stringified Zod JSON issues array into clean message and validation errors", () => {
    const rawZodJson = JSON.stringify([
      {
        code: "custom",
        message: "Pakistan (+92) phone number must be exactly 10 digits",
        path: ["phones", 0, "number"],
      },
    ]);
    const error = new ApiError(400, rawZodJson, "validation_error");
    expect(getApiValidationMessage(error)).toBe(
      "Pakistan (+92) phone number must be exactly 10 digits",
    );
    const errors = getApiValidationErrors(error);
    expect(errors).toHaveLength(1);
    expect(errors?.[0]?.tabId).toBe("phones");
    expect(errors?.[0]?.index).toBe(0);
    expect(errors?.[0]?.fieldId).toBe("number");
    expect(errors?.[0]?.message).toBe("Pakistan (+92) phone number must be exactly 10 digits");
  });
});
