import { afterEach, describe, expect, it, vi } from "vitest";
import { requestHostname } from "../lib/requestHost.js";
import { resolveSubdomainFromRequest } from "../lib/tenantContext.js";

describe("request host selection", () => {
  const previousDomain = process.env.MMS_APP_DOMAIN;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (previousDomain === undefined) {
      delete process.env.MMS_APP_DOMAIN;
    } else {
      process.env.MMS_APP_DOMAIN = previousDomain;
    }
  });

  it("prefers the public Host header over a spoofed X-Forwarded-Host", () => {
    expect(
      requestHostname({
        hostname: "demo.example.com",
        headers: {
          host: "demo.example.com",
          "x-forwarded-host": "evil.example.com",
        },
      }),
    ).toBe("demo.example.com");
  });

  it("uses X-Forwarded-Host for internal proxy hosts", () => {
    expect(
      requestHostname({
        hostname: "127.0.0.1",
        headers: {
          host: "127.0.0.1:3000",
          "x-forwarded-host": "demo.example.com",
        },
      }),
    ).toBe("demo.example.com");
  });

  it("resolves tenant subdomain from the selected host", () => {
    process.env.MMS_APP_DOMAIN = "example.com";
    expect(resolveSubdomainFromRequest("demo.example.com", "evil.example.com")).toBe("demo");
  });
});

describe("X-Forwarded-Host trust (F44)", () => {
  const internalHostRequest = {
    hostname: "127.0.0.1",
    headers: {
      host: "127.0.0.1:5002",
      "x-forwarded-host": "demo.example.com",
    },
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores X-Forwarded-Host in production by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MMS_TRUST_X_FORWARDED_HOST", "");
    expect(requestHostname(internalHostRequest)).toBe("127.0.0.1");
  });

  it("honours X-Forwarded-Host in production only with the explicit opt-in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MMS_TRUST_X_FORWARDED_HOST", "true");
    expect(requestHostname(internalHostRequest)).toBe("demo.example.com");
  });

  it("keeps the development/test proxy fallback", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MMS_TRUST_X_FORWARDED_HOST", "");
    expect(requestHostname(internalHostRequest)).toBe("demo.example.com");
  });

  it("never lets X-Forwarded-Host override a public Host in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MMS_TRUST_X_FORWARDED_HOST", "true");
    expect(
      requestHostname({
        hostname: "demo.example.com",
        headers: {
          host: "demo.example.com",
          "x-forwarded-host": "evil.example.com",
        },
      }),
    ).toBe("demo.example.com");
  });
});
