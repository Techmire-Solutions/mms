import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { initErrorReporting, reportClientError, reportClientWarn } from "./clientErrorReporting";

describe("clientErrorReporting", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("initErrorReporting completes safely when no DSN is present", () => {
    expect(() => initErrorReporting()).not.toThrow();
  });

  it("reportClientError logs error and context in development", () => {
    const error = new Error("Test error");
    const context = { componentStack: "\n in TestComponent" };

    reportClientError(error, context);

    expect(errorSpy).toHaveBeenCalled();
  });

  it("reportClientWarn logs warning and context in development", () => {
    const error = "Warning occurred";
    const context = { info: "extra context" };

    reportClientWarn(error, context);

    expect(warnSpy).toHaveBeenCalled();
  });
});
