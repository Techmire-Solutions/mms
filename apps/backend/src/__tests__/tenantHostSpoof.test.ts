import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSubdomainFromRequest } from "../lib/tenantContext.js";

const ENV_KEYS = ["NODE_ENV", "MMS_APP_DOMAIN", "MMS_TRUST_X_FORWARDED_HOST"] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("public tenant resolution", () => {
  it("ignores a forged X-Forwarded-Host in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.MMS_TRUST_X_FORWARDED_HOST;
    process.env.MMS_APP_DOMAIN = "mms.test";

    expect(resolveSubdomainFromRequest("demo.mms.test", "evil.mms.test")).toBe("demo");
  });

  it("honours X-Forwarded-Host only with the explicit proxy opt-in", () => {
    process.env.NODE_ENV = "production";
    process.env.MMS_TRUST_X_FORWARDED_HOST = "true";
    process.env.MMS_APP_DOMAIN = "mms.test";

    expect(resolveSubdomainFromRequest("localhost", "demo.mms.test")).toBe("demo");
  });
});
