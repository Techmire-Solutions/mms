import { afterEach, describe, expect, it } from "vitest";
import { requestHostname } from "../lib/requestHost.js";
import { resolveSubdomainFromRequest } from "../lib/tenantContext.js";

describe("request host selection", () => {
  const previousDomain = process.env.MMS_APP_DOMAIN;

  afterEach(() => {
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
