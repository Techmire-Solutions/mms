import { describe, expect, it } from "vitest";
import { isAuthErrorType, parseAuthError, getAuthErrorMessage } from "@/lib/authErrors";
import { AuthFailureError } from "@/lib/contexts/authContextHelpers";

describe("authErrors", () => {
  it("preserves known backend auth error types", async () => {
    const response = new Response(
      JSON.stringify({
        type: "email_not_verified",
        message: "Verify your email before signing in",
      }),
      { status: 403 },
    );

    await expect(parseAuthError(response)).resolves.toEqual({
      type: "email_not_verified",
      message: "Verify your email before signing in",
    });
  });

  it("accepts workspace disabled errors", () => {
    expect(isAuthErrorType("workspace_disabled")).toBe(true);
  });

  it("accepts all client auth error categories", () => {
    expect(isAuthErrorType("connection_error")).toBe(true);
    expect(isAuthErrorType("auth_required")).toBe(true);
    expect(isAuthErrorType("user_not_registered")).toBe(true);
    expect(isAuthErrorType("rate_limit_exceeded")).toBe(true);
  });

  it("preserves rate-limit retry timing", async () => {
    const response = new Response(
      JSON.stringify({ type: "rate_limit_exceeded", message: "Too many requests" }),
      { status: 429, headers: { "Retry-After": "12" } },
    );

    await expect(parseAuthError(response)).resolves.toEqual({
      type: "rate_limit_exceeded",
      message: "Too many requests",
      retryAfterSeconds: 12,
    });
  });

  it("falls back to invalid credentials for unknown JSON auth errors", async () => {
    const response = new Response(
      JSON.stringify({
        type: "unexpected_backend_type",
        message: "Backend still sent a useful message",
      }),
      { status: 401 },
    );

    await expect(parseAuthError(response)).resolves.toEqual({
      type: "invalid_credentials",
      message: "Backend still sent a useful message",
    });
  });

  it("falls back safely when an error response has no JSON body", async () => {
    const response = new Response("not-json", { status: 500 });

    await expect(parseAuthError(response)).resolves.toEqual({
      type: "connection_error",
      message: "Login failed",
    });
  });

  describe("getAuthErrorMessage", () => {
    const mockT = (key: string) => `[translated:${key}]`;

    it("translates invalid_credentials", () => {
      const err = new AuthFailureError({
        type: "invalid_credentials",
        message: "Invalid email or password",
      });
      expect(getAuthErrorMessage(err, mockT as unknown as never)).toBe(
        "[translated:auth.invalidCredentials]",
      );
    });

    it("translates email_not_verified", () => {
      const err = new AuthFailureError({
        type: "email_not_verified",
        message: "Verify your email before signing in",
      });
      expect(getAuthErrorMessage(err, mockT as unknown as never)).toBe(
        "[translated:auth.emailNotVerified]",
      );
    });

    it("translates connection_error", () => {
      const err = new AuthFailureError({
        type: "connection_error",
        message: "Failed to fetch",
      });
      expect(getAuthErrorMessage(err, mockT as unknown as never)).toBe(
        "[translated:errors.state.network]",
      );
    });

    it("translates rate limiting and includes the retry delay", () => {
      const err = new AuthFailureError({
        type: "rate_limit_exceeded",
        message: "Too many requests",
        retryAfterSeconds: 12,
      });
      expect(getAuthErrorMessage(err, mockT as unknown as never)).toBe(
        "[translated:errors.rate_limit_exceeded] [translated:errors.retryAfterSeconds]",
      );
    });

    it("preserves custom workspace_disabled message when provided", () => {
      const err = new AuthFailureError({
        type: "workspace_disabled",
        message: "Madrasa closed for maintenance",
      });
      expect(getAuthErrorMessage(err, mockT as unknown as never)).toBe(
        "Madrasa closed for maintenance",
      );
    });

    it("handles generic Error instances", () => {
      const err = new Error("Network timeout");
      expect(getAuthErrorMessage(err, mockT as unknown as never)).toBe("Network timeout");
    });
  });
});
