import { describe, expect, it } from "vitest";
import {
  MMS_PRODUCTION_BACKEND_PORT,
  MMS_PRODUCTION_FORBIDDEN_PORTS,
  productionPortViolation,
  resolveBackendListenPort,
} from "./serverPorts.js";

describe("serverPorts", () => {
  it("defaults to dev port locally", () => {
    expect(resolveBackendListenPort({ NODE_ENV: "development" })).toBe(3000);
  });

  it("defaults to production port in production", () => {
    expect(resolveBackendListenPort({ NODE_ENV: "production" })).toBe(MMS_PRODUCTION_BACKEND_PORT);
  });

  it("rejects forbidden ports in production", () => {
    for (const port of MMS_PRODUCTION_FORBIDDEN_PORTS) {
      expect(() =>
        resolveBackendListenPort({ NODE_ENV: "production", PORT: String(port) }),
      ).toThrow(/must not listen on port/);
    }
  });

  it("allows forbidden ports in development", () => {
    expect(resolveBackendListenPort({ NODE_ENV: "development", PORT: "3000" })).toBe(3000);
    expect(resolveBackendListenPort({ NODE_ENV: "development", PORT: "3001" })).toBe(3001);
  });

  it("productionPortViolation flags 3000 and 3001", () => {
    expect(productionPortViolation(3000)).toMatch(/must not use port 3000/);
    expect(productionPortViolation(3001)).toMatch(/must not use port 3001/);
    expect(productionPortViolation(MMS_PRODUCTION_BACKEND_PORT)).toBeNull();
  });
});
