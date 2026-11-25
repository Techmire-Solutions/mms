import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getWorkspaceBySubdomain: vi.fn(),
  fetchPublicBrandingForSubdomain: vi.fn(),
  findRegistrationLinkBySlugTx: vi.fn(),
  findSessionById: vi.fn(),
  listActiveRegistrationLinksTx: vi.fn(),
  findSessionsByIds: vi.fn(),
}));

vi.mock("../services/workspaceService.js", () => ({
  getWorkspaceBySubdomain: mocks.getWorkspaceBySubdomain,
  fetchPublicBrandingForSubdomain: mocks.fetchPublicBrandingForSubdomain,
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenantRead: vi.fn(async (_subdomain: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({}),
  ),
  withTenant: vi.fn(),
}));

vi.mock("../enrollments/repository/admissionsRepositoryAdapter.js", () => ({
  admissionsRepository: {
    findRegistrationLinkBySlugTx: mocks.findRegistrationLinkBySlugTx,
    findSessionById: mocks.findSessionById,
    listActiveRegistrationLinksTx: mocks.listActiveRegistrationLinksTx,
    findSessionsByIds: mocks.findSessionsByIds,
  },
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn(),
}));

const { viewPublicRegistration, listOpenRegistrations } =
  await import("../enrollments/use-cases/registrationPublicUseCases.js");

describe("registrationPublicUseCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceBySubdomain.mockResolvedValue({
      id: "w1",
      subdomain: "demo",
      madrasaName: "Demo Madrasa",
      enabled: true,
      status: "active",
    });
    mocks.fetchPublicBrandingForSubdomain.mockResolvedValue({
      madrasaName: "Demo Madrasa Branded",
      logoUrl: "https://example.com/logo.png",
      tagline: "Inspiring Excellence",
    });
  });

  it("viewPublicRegistration includes branding logoUrl and madrasaName", async () => {
    mocks.findRegistrationLinkBySlugTx.mockResolvedValue({
      id: "l1",
      sessionId: "s1",
      slug: "slug-123456789",
      title: "Hifz 2026",
      isActive: true,
      opensAt: null,
      closesAt: null,
      maxSubmissions: null,
      requiresReview: true,
      classIds: [],
      submissionCount: 0,
      deletedAt: null,
    });
    mocks.findSessionById.mockResolvedValue({
      id: "s1",
      name: "Hifz 2026",
      status: "open",
      startDate: "2026-06-01",
      classes: [],
    });

    const view = await viewPublicRegistration("demo", "slug-123456789");

    expect(view.slug).toBe("slug-123456789");
    expect(view.madrasaName).toBe("Demo Madrasa Branded");
    expect(view.logoUrl).toBe("https://example.com/logo.png");
  });

  it("listOpenRegistrations includes branding logoUrl across all active links", async () => {
    mocks.listActiveRegistrationLinksTx.mockResolvedValue([
      {
        id: "l1",
        sessionId: "s1",
        slug: "slug-open-1",
        title: "Session 1",
        isActive: true,
        opensAt: null,
        closesAt: null,
        maxSubmissions: null,
        requiresReview: true,
        classIds: [],
        submissionCount: 0,
        deletedAt: null,
      },
    ]);
    mocks.findSessionsByIds.mockResolvedValue([
      {
        id: "s1",
        name: "Session 1",
        status: "open",
        startDate: "2026-06-01",
        classes: [],
      },
    ]);

    const views = await listOpenRegistrations("demo");

    expect(views.length).toBe(1);
    expect(views[0].logoUrl).toBe("https://example.com/logo.png");
    expect(views[0].madrasaName).toBe("Demo Madrasa Branded");
  });
});
