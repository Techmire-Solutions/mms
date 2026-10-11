import { afterEach, describe, expect, it } from "vitest";
import { loadBackendEnv, resolveBackendRoot } from "../config/loadEnv.js";

describe("loadBackendEnv", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("resolveBackendRoot points at apps/backend", () => {
    expect(resolveBackendRoot()).toMatch(/apps[\\/]backend$/);
  });

  it("forces the process timezone to UTC regardless of the host", () => {
    // Regression guard: on a non-UTC host, drizzle-orm's
    // `timestamp({ withTimezone: true, mode: 'date' })` columns read back shifted
    // by the host's local offset (Node's Date/Intl timezone resolution, not
    // Postgres), which silently made valid, unexpired `auth_artifacts` rows
    // (e.g. tenant password-reset OTPs) look already-expired.
    process.env.TZ = "Asia/Karachi";
    loadBackendEnv();
    expect(process.env.TZ).toBe("UTC");
  });
});
