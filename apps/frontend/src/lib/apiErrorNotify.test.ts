import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppTranslationKey } from "@mms/shared";
import { ApiError } from "@/lib/apiClient";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

const notifyError = vi.fn();

vi.mock("@/lib/notify", () => ({
  notify: {
    error: (...args: unknown[]) => notifyError(...args),
  },
}));

import { notifyApiFailure } from "@/lib/apiErrorNotify";

const EN: Partial<Record<AppTranslationKey, string>> = {
  "errors.rate_limit_exceeded": "Too many requests. Please wait and try again.",
  "errors.retryAfterSeconds": "Try again in {seconds} seconds.",
  "settings.serverSaveFailed": "Could not save. Please try again.",
  "errors.boundary.description": "Something went wrong.",
};

const t: TranslationFunction = (key, ...args) => {
  const template = EN[key] ?? key;
  const vars = args[0];
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (out, [name, value]) => out.replace(`{${name}}`, String(value)),
    template,
  );
};

describe("notifyApiFailure", () => {
  beforeEach(() => {
    notifyError.mockReset();
  });

  it("notifies rate-limit errors with retry-after description", () => {
    notifyApiFailure(
      new ApiError(429, "Slow down", "rate_limit_exceeded", undefined, undefined, 12),
      t,
    );

    expect(notifyError).toHaveBeenCalledWith("Too many requests. Please wait and try again.", {
      description: "Try again in 12 seconds.",
      duration: 12_000,
    });
  });

  it("notifies 429 without retry-after seconds", () => {
    notifyApiFailure(new ApiError(429, "Slow down", "rate_limit_exceeded"), t);

    expect(notifyError).toHaveBeenCalledWith("Too many requests. Please wait and try again.", {
      description: undefined,
      duration: undefined,
    });
  });

  it("falls back for non-API errors", () => {
    notifyApiFailure(new Error("boom"), t);

    expect(notifyError).toHaveBeenCalledWith("Could not save. Please try again.");
  });

  it("uses the provided fallback key for other API errors", () => {
    notifyApiFailure(new ApiError(500, "fail", "server_error"), t, "errors.boundary.description");

    expect(notifyError).toHaveBeenCalledWith("Something went wrong.");
  });
});
