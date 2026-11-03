import { describe, expect, it, vi } from "vitest";
import type pg from "pg";
import { prepareContactSystemTagsPreMigration } from "../db/contactSystemTagsPreMigration.js";

describe("prepareContactSystemTagsPreMigration", () => {
  it("skips cleanup if contact_tags table does not exist (fresh database)", async () => {
    const mockQuery = vi.fn().mockImplementation((queryText: string) => {
      if (queryText.includes("information_schema.tables")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const mockClient = {
      query: mockQuery,
    } as unknown as pg.Client;

    await prepareContactSystemTagsPreMigration(mockClient);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0]?.[0]).toContain("information_schema.tables");
  });

  it("skips cleanup if system_key column already exists in contact_tags", async () => {
    const mockQuery = vi.fn().mockImplementation((queryText: string) => {
      if (queryText.includes("information_schema.tables")) {
        return Promise.resolve({ rows: [{ table_name: "contact_tags" }] });
      }
      if (queryText.includes("information_schema.columns")) {
        return Promise.resolve({ rows: [{ column_name: "system_key" }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const mockClient = {
      query: mockQuery,
    } as unknown as pg.Client;

    await prepareContactSystemTagsPreMigration(mockClient);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[0]?.[0]).toContain("information_schema.tables");
    expect(mockQuery.mock.calls[1]?.[0]).toContain("information_schema.columns");
  });

  it("executes conflict cleanup statements when contact_tags exists but system_key column does not", async () => {
    const mockQuery = vi.fn().mockImplementation((queryText: string) => {
      if (queryText.includes("information_schema.tables")) {
        return Promise.resolve({ rows: [{ table_name: "found" }] });
      }
      if (queryText.includes("information_schema.columns")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const mockClient = {
      query: mockQuery,
    } as unknown as pg.Client;

    await prepareContactSystemTagsPreMigration(mockClient);

    // 1 table check + 1 col check + 3 table checks (students, faculty, rel) + 3 cleanup DELETE statements
    expect(mockQuery).toHaveBeenCalledTimes(8);
  });
});
