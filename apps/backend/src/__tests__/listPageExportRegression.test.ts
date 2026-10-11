import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { faculty } from "../db/schema/faculty.js";
import { runListPage } from "../db/repositories/listPageHelper.js";
import { generateCsvStreamChunks } from "../lib/csvExportStreamFactory.js";

describe("Count-free CSV pagination", () => {
  it.each([100, 150, 250])(
    "given %s matching rows, exports every row without requesting a count",
    async (size) => {
      // Arrange
      const records = Array.from({ length: size }, (_, index) => ({ id: String(index) }));
      const tx = {
        select(projection: object) {
          expect(projection).not.toHaveProperty("count");
          let limit = 100;
          const query = {
            from: () => query,
            where: () => query,
            orderBy: () => query,
            limit: (value: number) => {
              limit = value;
              return query;
            },
            offset: async (value: number) => records.slice(value, value + limit),
          };
          return query;
        },
      };
      // Act: sorted exports use offset pagination to retain their requested order.
      const chunks = generateCsvStreamChunks({
        filename: "faculty.csv",
        chunkSize: 100,
        columns: [{ label: "ID" }],
        loadByIds: async () => [],
        loadPage: async (page, limit) => {
          const result = await runListPage<{ id: string }, { id: string }>(tx as never, faculty, {
            page,
            limit,
            skipCount: true,
            conditions: [],
            orderBy: sql`${faculty.id} asc`,
            rowMapper: (row) => row,
          });
          return { rows: result.items, hasMore: result.hasMore };
        },
        yieldDataChunks: function* (rows) {
          for (const row of rows) yield `\n${row.id}`;
        },
      });
      let csv = "";
      for await (const chunk of chunks) csv += chunk;
      // Assert
      expect(csv.split("\n").slice(1)).toEqual(records.map((row) => row.id));
    },
  );
});
