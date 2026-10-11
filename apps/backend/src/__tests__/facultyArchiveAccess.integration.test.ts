import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import facultyRoutes from "../routes/tenant/faculty.js";

const { loadPage, loadOne } = vi.hoisted(() => ({ loadPage: vi.fn(), loadOne: vi.fn() }));
vi.mock("../middleware/authenticate.js", () => ({ authenticateTenant: async () => {} }));
vi.mock("../middleware/requireTenantModule.js", () => ({ registerModuleAccess: vi.fn() }));
vi.mock("../db/tenant-context.js", () => ({
  withTenant: (_tenant: string, work: () => Promise<unknown>) => work(),
}));
vi.mock("../routes/tenant/faculty/index.js", () => ({
  facultySetupConfigRoutes: async () => {},
  facultyLookupRoutes: async () => {},
  facultyExportRoutes: async () => {},
  facultySoftDeleteRoutes: async () => {},
  facultyAggregateRoutes: async () => {},
  facultyCrudRoutes: async () => {},
  sanitizeFacultyForUser: async (rows: unknown) => rows,
  sanitizeOneFacultyForUser: async (row: unknown) => row,
}));
vi.mock("../faculty/use-cases/facultyUseCases.js", () => ({
  facultyUseCases: { loadFacultyPage: loadPage, loadFacultyById: loadOne },
}));
beforeEach(() => {
  loadPage.mockReset().mockResolvedValue({
    faculty: [{ id: "archived" }],
    total: 1,
    page: 1,
    limit: 50,
    hasMore: false,
  });
  loadOne.mockReset().mockResolvedValue({ id: "archived" });
});

describe("Versioned faculty archive permissions", () => {
  it.each([
    ["teacher", "", 200],
    ["teacher", "?includeDeleted=true", 403],
    ["admin", "?includeDeleted=true", 200],
  ] as const)(
    "given %s, returns %s access status %s for list and detail",
    async (role, query, expected) => {
      // Arrange: exercise explicit versioned routes without the app URL rewrite.
      const app = Fastify();
      app.addHook("preHandler", async (request) => {
        request.user = {
          id: "u",
          name: "User",
          email: "u@example.test",
          role,
          workspaceSubdomain: "demo",
        };
        request.tenant = { id: "demo" };
      });
      await app.register(facultyRoutes);
      try {
        // Act / Assert
        for (const suffix of ["", "/archived"]) {
          const response = await app.inject({
            method: "GET",
            url: `/api/v1/tenant/faculty${suffix}${query}`,
            headers: { host: "demo.localhost" },
          });
          expect(response.statusCode).toBe(expected);
        }
        if (expected === 403) {
          expect(loadPage).not.toHaveBeenCalled();
          expect(loadOne).not.toHaveBeenCalled();
        }
      } finally {
        await app.close();
      }
    },
  );
});
