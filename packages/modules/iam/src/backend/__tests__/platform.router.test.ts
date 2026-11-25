import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IamError } from "../../shared/errors.js";
import type { IamPlatformActor } from "../../shared/types.js";
import type { IamService } from "../iam.service.js";
import { platformIamRoutes } from "../platform.router.js";

const PLATFORM_ACTOR: IamPlatformActor = {
  id: "p1",
  role: "super_user",
  permissions: {
    admins: true,
    workspaces: true,
    onboard: true,
    settings: true,
    system: true,
    contacts: true,
    messaging: true,
  },
  name: "Operator",
  email: "operator@example.com",
};

const EMPTY_PAGE = { items: [], total: 0, page: 1, limit: 25, hasMore: false };

function stubService(overrides: Record<string, unknown> = {}): IamService {
  const base = {
    listMembers: vi.fn(),
    listRoles: vi.fn(),
    createMember: vi.fn(),
    inviteMember: vi.fn(),
    updateMember: vi.fn(),
    removeMember: vi.fn(),
    restoreMember: vi.fn(),
    resetMemberPassword: vi.fn(),
    listPlatformAdmins: vi.fn(async () => []),
    searchUsers: vi.fn(async () => EMPTY_PAGE),
    searchOrganizations: vi.fn(async () => EMPTY_PAGE),
    setTenantUserStatus: vi.fn(async () => ({ tenant: "acme", user: { id: "u1" } })),
    beginImpersonation: vi.fn(async () => ({
      handoffUrl: "https://acme.example/login?handoff=x",
      expiresAt: new Date().toISOString(),
      auditId: "audit-1",
    })),
    ...overrides,
  };
  return base as unknown as IamService;
}

const openApps: FastifyInstance[] = [];

function buildApp(
  service: IamService,
  options: { actor?: IamPlatformActor | null; superUser?: "allow" | "deny" } = {},
): FastifyInstance {
  const { actor = PLATFORM_ACTOR, superUser = "allow" } = options;
  const app = Fastify();
  app.addHook("onRequest", async (request) => {
    if (!actor) return;
    (request as unknown as { platformUser?: IamPlatformActor }).platformUser = actor;
  });
  app.register(platformIamRoutes, {
    service,
    requireSuperUser: async (_request, reply) => {
      if (superUser === "deny") {
        return reply.status(403).send({ type: "forbidden", message: "super_user required" });
      }
    },
  });
  openApps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe("platform IAM router", () => {
  it("rejects requests without a platform actor", async () => {
    const service = stubService();
    const response = await buildApp(service, { actor: null }).inject({
      method: "GET",
      url: "/api/platform/iam/users?q=ab",
    });
    expect(response.statusCode).toBe(403);
    expect(service.searchUsers).not.toHaveBeenCalled();
  });

  it("rejects a search query shorter than two characters", async () => {
    const service = stubService();
    const response = await buildApp(service).inject({
      method: "GET",
      url: "/api/platform/iam/users?q=a",
    });
    expect(response.statusCode).toBe(400);
    expect(service.searchUsers).not.toHaveBeenCalled();
  });

  it("searches across tenants for an authorized platform admin", async () => {
    const service = stubService();
    const response = await buildApp(service).inject({
      method: "GET",
      url: "/api/platform/iam/users?q=amina&page=2&limit=10",
    });
    expect(response.statusCode).toBe(200);
    expect(service.searchUsers).toHaveBeenCalledWith(PLATFORM_ACTOR, "amina", 2, 10);
  });

  it("runs the super-user pre-handler on status mutations", async () => {
    const service = stubService();
    const response = await buildApp(service, { superUser: "deny" }).inject({
      method: "PATCH",
      url: "/api/platform/iam/users/acme/u1/status",
      payload: { status: "suspended", reason: "support request for abuse", currentPassword: "pw" },
    });
    expect(response.statusCode).toBe(403);
    expect(service.setTenantUserStatus).not.toHaveBeenCalled();
  });

  it("suspends a tenant user when the super-user gate passes", async () => {
    const service = stubService();
    const response = await buildApp(service).inject({
      method: "PATCH",
      url: "/api/platform/iam/users/acme/u1/status",
      payload: { status: "suspended", reason: "support request for abuse", currentPassword: "pw" },
    });
    expect(response.statusCode).toBe(200);
    expect(service.setTenantUserStatus).toHaveBeenCalledWith(
      PLATFORM_ACTOR,
      expect.objectContaining({ tenant: "acme", userId: "u1", status: "suspended" }),
    );
  });

  it("validates the impersonation reason before calling the service", async () => {
    const service = stubService();
    const response = await buildApp(service).inject({
      method: "POST",
      url: "/api/platform/iam/impersonations",
      payload: { tenant: "acme", userId: "u1", reason: "too short", currentPassword: "pw" },
    });
    expect(response.statusCode).toBe(400);
    expect(service.beginImpersonation).not.toHaveBeenCalled();
  });

  it("starts an audited impersonation", async () => {
    const service = stubService();
    const response = await buildApp(service).inject({
      method: "POST",
      url: "/api/platform/iam/impersonations",
      payload: {
        tenant: "acme",
        userId: "u1",
        reason: "support request for abuse",
        currentPassword: "pw",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ auditId: "audit-1" });
    expect(service.beginImpersonation).toHaveBeenCalledWith(
      PLATFORM_ACTOR,
      expect.objectContaining({ tenant: "acme", userId: "u1" }),
    );
  });

  it("maps a typed policy failure to 403", async () => {
    const service = stubService({
      searchUsers: vi.fn(async () => {
        throw new IamError("forbidden", "Missing platform IAM permission: admins");
      }),
    });
    const response = await buildApp(service).inject({
      method: "GET",
      url: "/api/platform/iam/users?q=amina",
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ type: "forbidden" });
  });
});
