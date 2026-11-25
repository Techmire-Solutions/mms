import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWorkspaceBySubdomain: vi.fn(),
  fetchPublicBrandingForSubdomain: vi.fn(),
  findRegistrationLinkBySlugTx: vi.fn(),
  findSessionById: vi.fn(),
  listActiveRegistrationLinksTx: vi.fn(),
  findSessionsByIds: vi.fn(),
}));

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),
  withTenantRead: vi.fn(async (_subdomain: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({}),
  ),
  withTenant: vi.fn(),
}));

vi.mock("@mms/be-core/audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/be-core/audit")>()),
  recordModernAuditEvent: vi.fn(),
}));

vi.mock("@mms/mod-enrollments/backend/deps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-enrollments/backend/deps")>()),
  getWorkspaceBySubdomain: mocks.getWorkspaceBySubdomain,
  fetchPublicBrandingForSubdomain: mocks.fetchPublicBrandingForSubdomain,
  findRegistrationLinkBySlugTx: mocks.findRegistrationLinkBySlugTx,
  findSessionById: mocks.findSessionById,
  listActiveRegistrationLinksTx: mocks.listActiveRegistrationLinksTx,
  findSessionsByIds: mocks.findSessionsByIds,
}));

vi.mock("@mms/mod-enrollments/backend/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-enrollments/backend/repository")>()),
  admissionsRepository: {
    findRegistrationLinkBySlugTx: mocks.findRegistrationLinkBySlugTx,
    findSessionById: mocks.findSessionById,
    listActiveRegistrationLinksTx: mocks.listActiveRegistrationLinksTx,
    findSessionsByIds: mocks.findSessionsByIds,
  },
}));

const { viewPublicRegistration, listOpenRegistrations } =
  await import("@mms/mod-enrollments/backend/use-cases");

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
