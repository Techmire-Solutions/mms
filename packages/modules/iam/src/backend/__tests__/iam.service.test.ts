import { afterEach, describe, expect, it, vi } from "vitest";
import { registerTenantScopeBypassSink, resetTenantScopeBypassSinksForTesting } from "@mms/db";
import type { IamPorts } from "../ports.js";
import { createIamService } from "../iam.service.js";
import type { IamPlatformActor, IamTenantContext } from "../../shared/types.js";

const ctx: IamTenantContext = {
  tenantId: "acme",
  actor: { id: "u1", role: "admin" },
  requestId: "req-1",
};

const platformActor: IamPlatformActor = {
  id: "p1",
  role: "super_user",
  permissions: {
    admins: true,
    workspaces: false,
    onboard: false,
    settings: false,
    system: false,
    contacts: false,
    messaging: false,
  },
  name: "Operator",
  email: "op@example.com",
};

const member = {
  id: "u2",
  name: "Target",
  email: "t@example.com",
  role: "teacher",
  status: "active" as const,
};

function ports(
  overrides: Partial<IamPorts["platform"]> = {},
  tenantOverride: Partial<IamPorts["tenant"]> = {},
): IamPorts {
  return {
    tenant: {
      listMembers: vi.fn(async () => ({ users: [], total: 0, page: 1, limit: 50, hasMore: false })),
      inviteMember: vi.fn(async () => ({ user: {} as never })),
      createMember: vi.fn(async () => ({ user: {} as never })),
      updateMember: vi.fn(async () => ({}) as never),
      removeMember: vi.fn(async () => true),
      restoreMember: vi.fn(async () => true),
      resetMemberPassword: vi.fn(async () => true),
      loadMembers: vi.fn(async () => [member]),
      listRoles: vi.fn(async () => []),
      ...tenantOverride,
    },
    platform: {
      verifyActorPassword: vi.fn(async () => true),
      listAdmins: vi.fn(async () => []),
      searchUsers: vi.fn(async () => []),
      countUsers: vi.fn(async () => 0),
      searchOrganizations: vi.fn(async () => []),
      countOrganizations: vi.fn(async () => 0),
      findTenantUser: vi.fn(async () => member),
      setTenantUserStatus: vi.fn(async () => member),
      insertPlatformActivity: vi.fn(async () => "audit-1"),
      issueImpersonationHandoff: vi.fn(async () => ({
        handoffUrl: "https://acme.example.com/login?handoff=abc",
        expiresAt: new Date().toISOString(),
      })),
      revokeTenantUserSessions: vi.fn(async () => undefined),
      ...overrides,
    },
    audit: { recordTenantAudit: vi.fn(async () => undefined) },
  };
}

afterEach(() => resetTenantScopeBypassSinksForTesting());

describe("IamService", () => {
  it("audits bypassed cross-tenant searches (started + completed)", async () => {
    const sink = vi.fn();
    registerTenantScopeBypassSink(sink);
    const p = ports({ searchUsers: vi.fn(async () => []) });
    const service = createIamService(p);
    await service.searchUsers(platformActor, "acme");
    expect(sink.mock.calls.map(([event]) => event.phase)).toEqual(["started", "completed"]);
    expect(sink.mock.calls[0][0].reason).toContain("cross-tenant");
  });

  it("paginates cross-tenant search with a real total", async () => {
    const p = ports({
      searchUsers: vi.fn(async () => [{ tenant: "acme", user: { ...member } }]),
      countUsers: vi.fn(async () => 3),
    });
    const page = await createIamService(p).searchUsers(platformActor, "amina", 2, 1);

    expect(page).toMatchObject({
      total: 3,
      page: 2,
      limit: 1,
      hasMore: true,
      items: [{ tenant: "acme" }],
    });
    expect(p.platform.searchUsers).toHaveBeenCalledWith("amina", 1, 1);
    expect(p.platform.countUsers).toHaveBeenCalledWith("amina");
  });

  it("paginates organizations with a real total", async () => {
    const p = ports({
      searchOrganizations: vi.fn(async () => [
        { subdomain: "acme", madrasaName: "Acme", enabled: true },
      ]),
      countOrganizations: vi.fn(async () => 2),
    });
    const page = await createIamService(p).searchOrganizations(platformActor, "ac", 1, 1);

    expect(page).toMatchObject({ total: 2, page: 1, limit: 1, hasMore: true });
    expect(p.platform.searchOrganizations).toHaveBeenCalledWith("ac", 1, 0);
  });

  it("fails closed when a bypass audit sink fails", async () => {
    registerTenantScopeBypassSink(() => {
      throw new Error("audit unavailable");
    });
    const service = createIamService(ports());
    await expect(service.searchUsers(platformActor, "acme")).rejects.toThrow(/audit unavailable/);
  });

  it("refuses suspension for non-super-users and wrong passwords", async () => {
    const service = createIamService(ports());
    await expect(
      service.setTenantUserStatus(
        { ...platformActor, role: "admin" },
        {
          tenant: "acme",
          userId: "u2",
          status: "suspended",
          reason: "support request for abuse",
          currentPassword: "pw",
        },
      ),
    ).rejects.toThrow(/Super-user/);

    const wrongPassword = createIamService(
      ports({ verifyActorPassword: vi.fn(async () => false) }),
    );
    await expect(
      wrongPassword.setTenantUserStatus(platformActor, {
        tenant: "acme",
        userId: "u2",
        status: "suspended",
        reason: "support request for abuse",
        currentPassword: "wrong",
      }),
    ).rejects.toThrow(/password/);
  });

  it("suspends, revokes sessions and writes both audit records", async () => {
    const p = ports();
    const service = createIamService(p);
    const result = await service.setTenantUserStatus(platformActor, {
      tenant: "acme",
      userId: "u2",
      status: "suspended",
      reason: "support request for abuse",
      currentPassword: "pw",
    });
    expect(result.tenant).toBe("acme");
    expect(p.platform.revokeTenantUserSessions).toHaveBeenCalledWith("acme", "u2");
    expect(p.platform.insertPlatformActivity).toHaveBeenCalled();
    expect(p.audit.recordTenantAudit).toHaveBeenCalled();
  });

  it("rejects impersonation of inactive users and short reasons", async () => {
    const service = createIamService(ports());
    await expect(
      service.beginImpersonation(platformActor, {
        tenant: "acme",
        userId: "u2",
        reason: "short",
        currentPassword: "pw",
      }),
    ).rejects.toThrow(/Reason/);

    const inactive = ports({
      findTenantUser: vi.fn(async () => ({ ...member, status: "suspended" as const })),
    });
    await expect(
      createIamService(inactive).beginImpersonation(platformActor, {
        tenant: "acme",
        userId: "u2",
        reason: "support request investigation",
        currentPassword: "pw",
      }),
    ).rejects.toThrow(/active tenant users/);
  });

  it("enforces tenant last-admin policy on removal", async () => {
    const p = ports(
      {},
      { loadMembers: vi.fn(async () => [{ ...member, id: "u2", role: "admin" }]) },
    );
    await expect(createIamService(p).removeMember(ctx, "u2")).rejects.toThrow(/last active/);
  });

  it("blocks demoting the last active admin by role change", async () => {
    const p = ports(
      {},
      { loadMembers: vi.fn(async () => [{ ...member, id: "u2", role: "admin" }]) },
    );
    await expect(createIamService(p).updateMember(ctx, "u2", { role: "teacher" })).rejects.toThrow(
      /last active/,
    );
  });

  it("allows a role demotion when another active admin remains", async () => {
    const p = ports(
      {},
      {
        loadMembers: vi.fn(async () => [
          { ...member, id: "u2", role: "admin" },
          { ...member, id: "u3", role: "admin" },
        ]),
      },
    );
    await expect(
      createIamService(p).updateMember(ctx, "u2", { role: "teacher" }),
    ).resolves.toBeDefined();
  });

  it("refuses self password reset through the admin endpoint", async () => {
    await expect(
      createIamService(ports()).resetMemberPassword(ctx, "u1", "temporary-pass"),
    ).rejects.toThrow(/own password/);
  });
});
