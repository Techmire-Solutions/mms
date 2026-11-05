import { describe, expect, it } from "vitest";
import { SESSION_SORT_FIELDS } from "../db/repositories/sessionRepositoryList.js";

describe("sessions list sort whitelist", () => {
  it("includes createdAt so the shared collection's recent-first query is honoured", () => {
    expect(SESSION_SORT_FIELDS.has("createdAt")).toBe(true);
  });

  it("still rejects arbitrary fields", () => {
    expect(SESSION_SORT_FIELDS.has("password")).toBe(false);
  });
});
