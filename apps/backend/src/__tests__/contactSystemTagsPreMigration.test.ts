import { describe, expect, it, vi } from "vitest";
import type pg from "pg";
import { prepareContactSystemTagsPreMigration } from "../db/migrations/contactSystemTagsPreMigration.js";

describe("prepareContactSystemTagsPreMigration", () => {
  it("skips cleanup if system_key column already exists in contact_tags", async () => {
    const mockQuery = vi.fn().mockImplementation((queryText: string) => {
      if (queryText.includes("information_schema.columns")) {
        return Promise.resolve({ rows: [{ column_name: "system_key" }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const mockClient = {
      query: mockQuery,
    } as unknown as pg.Client;

    await prepareContactSystemTagsPreMigration(mockClient);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0]?.[0]).toContain("information_schema.columns");
  });

  it("executes conflict cleanup statements when system_key column does not exist", async () => {
    const mockQuery = vi.fn().mockImplementation((queryText: string) => {
      if (queryText.includes("information_schema.columns")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const mockClient = {
      query: mockQuery,
    } as unknown as pg.Client;

    await prepareContactSystemTagsPreMigration(mockClient);

    // 1 check + 3 cleanup DELETE statements
    expect(mockQuery).toHaveBeenCalledTimes(4);
    expect(mockQuery.mock.calls[0]?.[0]).toContain("information_schema.columns");
    expect(mockQuery.mock.calls[1]?.[0]).toContain('DELETE FROM "contact_tags"');
    expect(mockQuery.mock.calls[2]?.[0]).toContain('DELETE FROM "contact_tags"');
    expect(mockQuery.mock.calls[3]?.[0]).toContain('DELETE FROM "contact_tags"');
  });
});
