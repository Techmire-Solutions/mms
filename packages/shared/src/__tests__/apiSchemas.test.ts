import { describe, expect, it } from "vitest";
import {
  baseListQuerySchema,
  bulkIdsBodySchema,
  includeDeletedQuerySchema,
  softDeleteBodySchema,
} from "../core/apiSchemas.js";
import { emailTestBodySchema } from "../schemas/email.dto.js";

describe("apiSchemas", () => {
  it("parses includeDeleted query", () => {
    expect(includeDeletedQuerySchema.parse({ includeDeleted: "true" })).toEqual({
      includeDeleted: "true",
    });
  });

  it("parses bulk ids with optional reason", () => {
    expect(bulkIdsBodySchema.parse({ ids: ["a", 2], deletionReason: "cleanup" })).toEqual({
      ids: ["a", 2],
      deletionReason: "cleanup",
    });
  });

  it("rejects empty bulk ids", () => {
    expect(() => bulkIdsBodySchema.parse({ ids: [] })).toThrow();
  });

  it("parses soft-delete body", () => {
    expect(softDeleteBodySchema.parse({})).toEqual({});
    expect(softDeleteBodySchema.parse({ deletionReason: "dup" })).toEqual({
      deletionReason: "dup",
    });
  });

  it("parses base list query with coerced page/limit", () => {
    expect(baseListQuerySchema.parse({ page: "2", limit: "25", search: "ali" })).toEqual({
      page: 2,
      limit: 25,
      search: "ali",
    });
  });
});

describe("emailTestBodySchema", () => {
  it("parses a valid test email", () => {
    expect(emailTestBodySchema.parse({ testEmail: "admin@example.com" })).toEqual({
      testEmail: "admin@example.com",
    });
  });

  it("allows the test email to be omitted so the route can fall back", () => {
    expect(emailTestBodySchema.parse({})).toEqual({});
  });

  it("rejects a malformed email", () => {
    expect(() => emailTestBodySchema.parse({ testEmail: "not-an-email" })).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() => emailTestBodySchema.parse({ testEmail: "a@b.co", extra: 1 })).toThrow();
  });
});
