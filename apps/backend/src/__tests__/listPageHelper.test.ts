import { describe, expect, it, vi } from "vitest";
import { runListPage } from "../db/repositories/listPageHelper.js";
import { students } from "../db/schema/students.js";
import { sql } from "drizzle-orm";

describe("runListPage - Cursor & Keyset Pagination", () => {
  it("supports offset-based pagination without afterId", async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            // If it is count query:
            then: (resolve: (val: unknown) => unknown) => resolve([{ count: 2 }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([{ id: "std-1", workspaceSubdomain: "demo" }]),
              }),
            }),
          })),
        }),
      }),
    };

    const result = await runListPage(mockTx as never, students as never, {
      conditions: [sql`workspace_subdomain = 'demo'`],
      orderBy: sql`id asc`,
      page: 1,
      limit: 1,
      rowMapper: (row) => row,
    });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeUndefined();
  });

  it("supports keyset cursor pagination with afterId and returns nextCursor", async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            then: (resolve: (val: unknown) => unknown) => resolve([{ count: 2 }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([{ id: "std-2", workspaceSubdomain: "demo" }]),
              }),
            }),
          })),
        }),
      }),
    };

    const result = await runListPage(mockTx as never, students as never, {
      conditions: [sql`workspace_subdomain = 'demo'`],
      orderBy: sql`id asc`,
      afterId: "std-1",
      limit: 1,
      rowMapper: (row) => row,
    });

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("std-2");
  });

  it("sets nextCursor to undefined when hasMore is false on last cursor page", async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            then: (resolve: (val: unknown) => unknown) => resolve([{ count: 1 }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([{ id: "std-2", workspaceSubdomain: "demo" }]),
              }),
            }),
          })),
        }),
      }),
    };

    const result = await runListPage(mockTx as never, students as never, {
      conditions: [sql`workspace_subdomain = 'demo'`],
      orderBy: sql`id asc`,
      afterId: "std-1",
      limit: 10,
      rowMapper: (row) => row,
    });

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeUndefined();
  });

  it("skips count query when skipCount is true", async () => {
    let countCalled = false;
    const mockTx = {
      select: vi.fn().mockImplementation((projection) => {
        if (projection && "count" in projection) {
          countCalled = true;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([{ id: "std-2", workspaceSubdomain: "demo" }]),
                }),
              }),
            }),
          }),
        };
      }),
    };

    const result = await runListPage(mockTx as never, students as never, {
      conditions: [sql`workspace_subdomain = 'demo'`],
      orderBy: sql`updated_at desc`,
      afterId: "std-1",
      limit: 10,
      skipCount: true,
      rowMapper: (row) => row,
    });

    expect(countCalled).toBe(false);
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(1);
  });
});
