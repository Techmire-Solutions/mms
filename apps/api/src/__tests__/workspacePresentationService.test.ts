import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListWorkspaceRowsPage = vi.fn();
const mockGetUserModulePreferencesByWorkspaces = vi.fn();
const mockGetWorkspaceAdminEmailsMap = vi.fn();

vi.mock("../db/repositories/workspaceRepository.js", () => ({
  listWorkspaceRowsPage: (...args: unknown[]) => mockListWorkspaceRowsPage(...args),
}));

vi.mock("@mms/mod-iam/backend/tenant/repository", () => ({
  getUserModulePreferencesByWorkspaces: (...args: unknown[]) =>
    mockGetUserModulePreferencesByWorkspaces(...args),
  getWorkspaceAdminEmailsMap: (...args: unknown[]) => mockGetWorkspaceAdminEmailsMap(...args),
}));

import { listPlatformWorkspaces } from "../services/workspacePresentationService.js";

const workspaceRow = {
  subdomain: "al-noor",
  madrasaName: "Al-Noor Academy",
  enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("listPlatformWorkspaces (SQL pagination)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListWorkspaceRowsPage.mockResolvedValue({
      rows: [{ workspace: workspaceRow, branding: null }],
      total: 3,
    });
    mockGetUserModulePreferencesByWorkspaces.mockResolvedValue(new Map());
    mockGetWorkspaceAdminEmailsMap.mockResolvedValue(new Map());
  });

  it("forwards filters/sort/pagination to the page query and returns hydrated rows", async () => {
    const result = await listPlatformWorkspaces({
      page: 2,
      limit: 5,
      search: "noor",
      status: "active",
      sortField: "createdAt",
      sortDir: "desc",
      dateFrom: "2026-01-01",
      dateTo: "2026-03-01",
    });

    expect(mockListWorkspaceRowsPage).toHaveBeenCalledWith({
      search: "noor",
      status: "active",
      sortField: "createdAt",
      sortDir: "desc",
      dateFrom: "2026-01-01",
      dateTo: "2026-03-01",
      limit: 5,
      offset: 5,
    });
    expect(result).toEqual({
      workspaces: [expect.objectContaining({ subdomain: "al-noor" })],
      total: 3,
      page: 2,
      pageSize: 5,
    });
  });

  it("defaults to page 1 / limit 25 and hydrates prefs/admin email for the page", async () => {
    mockGetUserModulePreferencesByWorkspaces.mockResolvedValue(
      new Map([["al-noor", { requireEmailVerification: true }]]),
    );
    mockGetWorkspaceAdminEmailsMap.mockResolvedValue(new Map([["al-noor", "admin@alnoor.test"]]));

    const result = await listPlatformWorkspaces({});

    expect(mockListWorkspaceRowsPage).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25, offset: 0 }),
    );
    expect(result.workspaces[0]).toEqual(
      expect.objectContaining({
        subdomain: "al-noor",
        requireEmailVerification: true,
        adminEmail: "admin@alnoor.test",
      }),
    );
  });
});
