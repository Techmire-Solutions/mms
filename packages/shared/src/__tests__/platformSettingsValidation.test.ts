import { describe, it, expect } from "vitest";
import {
  platformSettingsUpdateSchema,
  migrateAndRestartSchema,
  MIGRATE_AND_RESTART_CONFIRM,
} from "../platformSettingsTypes.js";
import { platformActivityLogsQuerySchema } from "../platformSchemas.js";

describe("platformSettingsValidation", () => {
  describe("platformActivityLogsQuerySchema", () => {
    it("applies defaults for empty query", () => {
      const parsed = platformActivityLogsQuerySchema.parse({});
      expect(parsed).toEqual({ limit: 50, offset: 0 });
    });

    it("coerces and clamps valid query parameters", () => {
      const parsed = platformActivityLogsQuerySchema.parse({ limit: "25", offset: "10" });
      expect(parsed).toEqual({ limit: 25, offset: 10 });
    });

    it("rejects out-of-range limit and negative offset", () => {
      expect(platformActivityLogsQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
      expect(platformActivityLogsQuerySchema.safeParse({ limit: "201" }).success).toBe(false);
      expect(platformActivityLogsQuerySchema.safeParse({ offset: "-1" }).success).toBe(false);
    });
  });

  describe("platformSettingsUpdateSchema", () => {
    it("validates correct update payloads", () => {
      const valid = {
        syncTlsOnCreate: true,
        tlsExtraSans: "*.madrasa.com",
        certbotEmail: "admin@madrasa.com",
      };
      const result = platformSettingsUpdateSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(valid);
      }
    });

    it("accepts empty certbot email or empty payload", () => {
      const emptyEmail = { certbotEmail: "" };
      const emptyPayload = {};

      expect(platformSettingsUpdateSchema.safeParse(emptyEmail).success).toBe(true);
      expect(platformSettingsUpdateSchema.safeParse(emptyPayload).success).toBe(true);
    });

    it("rejects invalid email format", () => {
      const invalid = { certbotEmail: "not-an-email" };
      const result = platformSettingsUpdateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("migrateAndRestartSchema", () => {
    it("accepts exact confirmation string with password", () => {
      const valid = { confirm: MIGRATE_AND_RESTART_CONFIRM, password: "secret" };
      const result = migrateAndRestartSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects missing password", () => {
      const invalid = { confirm: MIGRATE_AND_RESTART_CONFIRM };
      const result = migrateAndRestartSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects invalid confirmation string", () => {
      const invalid = { confirm: "RESTART", password: "secret" };
      const result = migrateAndRestartSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects unknown keys (strict)", () => {
      const invalid = {
        confirm: MIGRATE_AND_RESTART_CONFIRM,
        password: "secret",
        extra: true,
      };
      const result = migrateAndRestartSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
