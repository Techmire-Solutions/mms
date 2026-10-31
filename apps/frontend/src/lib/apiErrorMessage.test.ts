import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "./apiErrorMessage";

describe("apiErrorMessage", () => {
  it("given a ts-rest rejection, should return the server message when reading it", () => {
    // Arrange
    const rejection = { status: 400, body: { type: "validation_error", message: "Invalid body" } };

    // Act
    const message = apiErrorMessage(rejection, "fallback");

    // Assert
    expect(message).toBe("Invalid body");
  });

  it("given a thrown Error, should return its message when reading it", () => {
    // Arrange
    const error = new Error("boom");

    // Act
    const message = apiErrorMessage(error, "fallback");

    // Assert
    expect(message).toBe("boom");
  });

  it("given an unrecognized value, should return the fallback instead of [object Object]", () => {
    // Arrange
    const rejection = { status: 500, body: {} };

    // Act
    const message = apiErrorMessage(rejection, "fallback");

    // Assert
    expect(message).toBe("fallback");
  });
});
