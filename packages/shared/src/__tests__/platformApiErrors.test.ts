import { describe, expect, it } from "vitest";
import {
  PLATFORM_API_ERROR_TYPES,
  PLATFORM_HTTP_ERROR_TYPES,
  PLATFORM_SERVICE_ERROR_CODES,
  PLATFORM_SERVICE_ERROR_STATUSES,
} from "../auth/platformApiErrors.js";

describe("platformApiErrors", () => {
  it("covers every service error code with an HTTP status", () => {
    for (const code of PLATFORM_SERVICE_ERROR_CODES) {
      expect(PLATFORM_SERVICE_ERROR_STATUSES[code]).toBeGreaterThanOrEqual(400);
    }
  });

  it("unions service + http types without duplicates", () => {
    expect(PLATFORM_API_ERROR_TYPES.length).toBe(
      PLATFORM_SERVICE_ERROR_CODES.length + PLATFORM_HTTP_ERROR_TYPES.length,
    );
    expect(new Set(PLATFORM_API_ERROR_TYPES).size).toBe(PLATFORM_API_ERROR_TYPES.length);
  });
});
