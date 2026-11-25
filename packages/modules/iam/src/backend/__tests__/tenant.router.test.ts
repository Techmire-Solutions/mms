import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "@mms/contracts";
import { IamError } from "../../shared/errors.js";
import type { IamService } from "../iam.service.js";
import { tenantIamRoutes } from "../tenant.router.js";

const MEMBER = {
  id: "u1",
  name: "Amina",
  email: "amina@example.com",
  role: "teacher",
  status: "active" as const,
  deletedAt: null,
};

const PAGE = { users: [MEMBER], total: 1, page: 1, limit: 50, hasMore: false };

function stubService(overrides: Record<string, unknown> = {}): IamService {
  const base = {
    listMembers: vi.fn(async () => PAGE),
    listRoles: vi.fn(async () => [{ id: "teacher", name: "Teacher" }]),
    createMember: vi.fn(async () => ({ user: MEMBER })),
    inviteMember: vi.fn(async () => ({ user: MEMBER, inviteEmailSent: true })),
    updateMember: vi.fn(async () => MEMBER),
    removeMember: vi.fn(async () => true),
    restoreMember: vi.fn(async () => true),
    resetMemberPassword: vi.fn(async () => true),
    listPlatformAdmins: vi.fn(async () => []),
    searchUsers: vi.fn(async () => ({ items: [], total: 0, page: 1, limit: 25, hasMore: false })),
    searchOrganizations: vi.fn(async () => ({
      items: [],
      total: 0,
      page: 1,
      limit: 25,
      hasMore: false,
    })),
    setTenantUserStatus: vi.fn(async () => ({ tenant: "acme", user: MEMBER })),
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

function buildApp(service: IamService, authenticated = true): FastifyInstance {
  const app = Fastify();
  app.addHook("onRequest", async (request) => {
    if (!authenticated) return;
    const scoped = request as unknown as { tenant?: { id: string }; user?: User };
    scoped.tenant = { id: "acme" };
    scoped.user = {
      id: "actor-1",
      role: "admin",
      name: "Admin",
      email: "admin@example.com",
    } as unknown as User;
  });
  app.register(tenantIamRoutes, { service });
  openApps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe("tenant IAM router", () => {
  it("rejects requests without an authenticated tenant", async () => {
    const service = stubService();
    const response = await buildApp(service, false).inject({
      method: "GET",
      url: "/api/iam/members",
    });
    expect(response.statusCode).toBe(403);
    expect(service.listMembers).not.toHaveBeenCalled();
  });

  it("rejects an invalid list query before touching the service", async () => {
    const service = stubService();
    const response = await buildApp(service).inject({
      method: "GET",
      url: "/api/iam/members?limit=500",
    });
    expect(response.statusCode).toBe(400);
    expect(service.listMembers).not.toHaveBeenCalled();
  });

  it("returns the member page for the active tenant", async () => {
    const service = stubService();
    const response = await buildApp(service).inject({ method: "GET", url: "/api/iam/members" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(PAGE);
    expect(service.listMembers).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "acme" }),
      expect.any(Object),
    );
  });

  it("maps a policy forbidden failure to 403", async () => {
    const service = stubService({
      inviteMember: vi.fn(async () => {
        throw new IamError("forbidden", "Insufficient permissions to manage this member");
      }),
    });
    const response = await buildApp(service).inject({
      method: "POST",
      url: "/api/iam/members/invite",
      payload: { contactId: "c1", role: "super_admin", status: "active", sendEmail: true },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ type: "forbidden" });
  });

  it("maps not-found and conflict failures to 404/409", async () => {
    const missing = stubService({
      updateMember: vi.fn(async () => {
        throw new IamError("not_found", "Member not found");
      }),
    });
    const notFound = await buildApp(missing).inject({
      method: "PATCH",
      url: "/api/iam/members/missing",
      payload: { role: "teacher" },
    });
    expect(notFound.statusCode).toBe(404);

    const conflict = stubService({
      removeMember: vi.fn(async () => {
        throw new IamError("conflict", "Cannot remove or suspend the last active administrator");
      }),
    });
    const conflicting = await buildApp(conflict).inject({
      method: "DELETE",
      url: "/api/iam/members/admin-1",
    });
    expect(conflicting.statusCode).toBe(409);
  });

  it("rejects a reset without a temporary password", async () => {
    const service = stubService();
    const response = await buildApp(service).inject({
      method: "POST",
      url: "/api/iam/members/u1/reset-password",
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(service.resetMemberPassword).not.toHaveBeenCalled();
  });

  it("returns the workspace roles", async () => {
    const service = stubService();
    const response = await buildApp(service).inject({ method: "GET", url: "/api/iam/roles" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ roles: [{ id: "teacher", name: "Teacher" }] });
  });
});
