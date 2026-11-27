import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken } from "./helpers/tokens.js";
import { createFacultyUseCases } from "@mms/mod-faculty/backend/use-cases";
import {
  SubordinateReassignmentError,
  SubordinateReassignmentUnavailableError,
} from "@mms/mod-faculty/backend/use-cases";
import type { Faculty } from "@mms/contracts";
import { type facultyRepository } from "@mms/mod-faculty/backend/repository";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  runInTransaction: (cb: () => unknown) => cb(),
  runInGlobalTransaction: (cb: () => unknown) => cb(),
}));

vi.mock("@mms/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/client")>()),
  runInTransaction: (cb: () => unknown) => cb(),
  runInGlobalTransaction: (cb: () => unknown) => cb(),
}));

vi.mock("@mms/be-core/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/be-core/http")>()),
  getRequestTenant: () => "demo",
  requireTenant: () => "demo",
}));

vi.mock("../lib/tenantContext.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/tenantContext.js")>();
  return {
    ...actual,
    getRequestTenant: () => "demo",
    requireTenant: () => "demo",
  };
});

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@mms/be-core/audit", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({ id: 1 }),
  sanitizeAuditState: (value: unknown) => value,
}));

vi.mock("@mms/be-core/data/outbox", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@mms/mod-faculty/backend/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-faculty/backend/repository")>()),
  cascadeSoftDeleteFacultyAssignments: vi.fn().mockResolvedValue(0),
  cascadeRestoreFacultyAssignments: vi.fn().mockResolvedValue(0),
  cascadeSoftDeleteFacultyEmployments: vi.fn().mockResolvedValue(0),
  cascadeRestoreFacultyEmployments: vi.fn().mockResolvedValue(0),
  flattenFacultyEmploymentFields: (member: unknown) => member,
  upsertFacultyEmploymentTx: vi.fn().mockResolvedValue("facemp-mock"),
  cascadeSoftDeleteFacultyEmployDesignations: vi.fn().mockResolvedValue(0),
  cascadeRestoreFacultyEmployDesignations: vi.fn().mockResolvedValue(0),
  upsertFacultyEmployDesignationTx: vi.fn().mockResolvedValue("faced-mock"),
}));

vi.mock("@mms/mod-faculty/backend/deps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-faculty/backend/deps")>()),
  loadContactsByIds: vi.fn().mockResolvedValue([]),
  loadContactsSummaryByIdsForTenant: vi.fn().mockResolvedValue([]),
}));

vi.mock("@mms/mod-contacts/backend/services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-contacts/backend/services")>()),
  loadContactsByIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/auth/authArtifactService.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/auth/authArtifactService.js")>()),
  deleteRefreshTokensForUser: vi.fn(),
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),

  authArtifactUserScopeKey: vi.fn(() => ""),
  authArtifactWorkspaceScopeKey: vi.fn(() => ""),
  deleteAuthArtifact: vi.fn().mockResolvedValue(undefined),
  findAuthArtifactByLookupKey: vi.fn().mockResolvedValue(null),
  tryClaimAuthArtifactByLookupKey: vi.fn().mockResolvedValue(null),
  updateAuthArtifactPayload: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  const demoWorkspace = {
    id: "ws-demo",
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
  };
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo" ? demoWorkspace : null,
      ),
  };
});

const mockLoadFacultyHierarchyTree = vi.fn();
const mockDeleteFacultyById = vi.fn();

vi.mock("@mms/mod-faculty/backend/use-cases", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/mod-faculty/backend/use-cases")>();
  const mocked = {
    ...actual.facultyUseCases,
    loadFacultyHierarchyTree: (...args: unknown[]) => mockLoadFacultyHierarchyTree(...args),
    deleteFacultyById: (...args: unknown[]) => mockDeleteFacultyById(...args),
  };
  return {
    ...actual,
    hydrateFacultyFromContacts: async (_tenant: unknown, rows: unknown) => rows,
    hydrateTeachersFromContacts: async (_tenant: unknown, rows: unknown) => rows,
    facultyUseCases: mocked,
  };
});

describe("Faculty Hierarchy and Task Management Domain Logic", () => {
  function createMockFacultyRepo(seedFaculty: Faculty[]) {
    const store = new Map<string, Faculty>(seedFaculty.map((f) => [String(f.id), { ...f }]));
    const repo: Partial<typeof facultyRepository> = {
      findById: vi.fn(async (_tenant: string, id: string) => store.get(id) ?? null),
      findByIds: vi.fn(async (_tenant: string, ids: string[]) =>
        ids.map((id) => store.get(id)).filter((f): f is Faculty => Boolean(f)),
      ),
      save: vi.fn(async (_tenant: string, faculty: Faculty) => {
        store.set(String(faculty.id), { ...faculty });
      }),
      findSubordinates: vi.fn(async (_tenant: string, id: string) =>
        [...store.values()].filter((f) => f.reportingFacultyId === id && !f.deletedAt),
      ),
      guardAssignmentDependents: vi.fn().mockResolvedValue(undefined),
      countSubordinates: vi.fn(
        async (_tenant: string, id: string) =>
          [...store.values()].filter((f) => f.reportingFacultyId === id && !f.deletedAt).length,
      ),
      reassignSubordinates: vi.fn(
        async (_tenant: string, oldSupervisorId: string, newSupervisorId: string | null) => {
          let count = 0;
          for (const f of store.values()) {
            if (f.reportingFacultyId === oldSupervisorId && !f.deletedAt) {
              f.reportingFacultyId = newSupervisorId;
              count++;
            }
          }
          return count;
        },
      ),
      bulkSave: vi.fn(async (_tenant: string, facultyList: Faculty[]) => {
        for (const f of facultyList) {
          store.set(String(f.id), { ...f });
        }
      }),
      listPage: vi.fn(async () => ({
        faculty: [...store.values()].filter((f) => !f.deletedAt),
        total: store.size,
        page: 1,
        limit: 100,
        hasMore: false,
      })),
      findSoftDeletedByContactId: vi.fn(async () => null),
      findAncestorChain: vi.fn(async (_tenant: string, facultyId: string, maxDepth = 50) => {
        const ancestors: string[] = [];
        let curr = store.get(facultyId);
        let depth = 0;
        while (curr?.reportingFacultyId && depth < maxDepth) {
          ancestors.push(curr.reportingFacultyId);
          curr = store.get(curr.reportingFacultyId);
          depth++;
        }
        return ancestors;
      }),
    };
    return { repo: repo as typeof facultyRepository, store };
  }

  it("blocks deletion of faculty supervisor with active direct subordinates", async () => {
    const seed: Faculty[] = [
      { id: "f-supervisor", hierarchyRank: 2, status: "active", contactId: "c1" },
      {
        id: "f-subordinate",
        hierarchyRank: 3,
        reportingFacultyId: "f-supervisor",
        status: "active",
        contactId: "c2",
      },
    ];
    const { repo } = createMockFacultyRepo(seed);
    const useCases = createFacultyUseCases(repo);

    await expect(
      useCases.deleteFacultyById("f-supervisor", "admin-user", "Retiring"),
    ).rejects.toThrow(SubordinateReassignmentError);
  });

  it("refuses a supervisor delete that asks for reassignment the server cannot perform", async () => {
    // The production repository's `reassignSubordinates` is a no-op (the org-position
    // model was removed); only the test fake implemented it. Accepting the target
    // archived the supervisor and orphaned the subordinates while answering 200.
    const seed: Faculty[] = [
      { id: "f-old-sup", hierarchyRank: 2, status: "active", contactId: "c1" },
      { id: "f-new-sup", hierarchyRank: 2, status: "active", contactId: "c2" },
      {
        id: "f-subordinate",
        hierarchyRank: 3,
        reportingFacultyId: "f-old-sup",
        status: "active",
        contactId: "c3",
      },
    ];
    const { repo, store } = createMockFacultyRepo(seed);
    const useCases = createFacultyUseCases(repo);

    await expect(
      useCases.deleteFacultyById("f-old-sup", "admin-user", "Retiring", "f-new-sup"),
    ).rejects.toThrow(SubordinateReassignmentUnavailableError);

    expect(store.get("f-old-sup")?.deletedAt).toBeUndefined();
    expect(store.get("f-subordinate")?.reportingFacultyId).toBe("f-old-sup");
  });

  it("constructs an organizational hierarchy tree with root nodes and subordinates", async () => {
    const seed: Faculty[] = [
      {
        id: "f-dean",
        hierarchyRank: 1,
        reportingFacultyId: null,
        status: "active",
        contactId: "c1",
      },
      {
        id: "f-hod",
        hierarchyRank: 2,
        reportingFacultyId: "f-dean",
        status: "active",
        contactId: "c2",
      },
      {
        id: "f-lecturer",
        hierarchyRank: 4,
        reportingFacultyId: "f-hod",
        status: "active",
        contactId: "c3",
      },
    ];
    const { repo } = createMockFacultyRepo(seed);
    const useCases = createFacultyUseCases(repo);

    const { nodes } = await useCases.loadFacultyHierarchyTree();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("f-dean");
    expect(nodes[0].subordinates).toHaveLength(1);
    expect(nodes[0].subordinates[0].id).toBe("f-hod");
    expect(nodes[0].subordinates[0].subordinates).toHaveLength(1);
    expect(nodes[0].subordinates[0].subordinates[0].id).toBe("f-lecturer");
  });
});

describe("Faculty Hierarchy REST Endpoints", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("GET /api/faculty/hierarchy-tree returns 200 with hierarchy tree nodes", async () => {
    const mockNodes = [
      {
        id: "f-dean",
        name: "Dean Ahmad",
        designation: "Dean",
        hierarchyRank: 1,
        reportingFacultyId: null,
        subordinateCount: 1,
        subordinates: [
          {
            id: "f-hod",
            name: "Dr. Bilal",
            designation: "HoD",
            hierarchyRank: 2,
            reportingFacultyId: "f-dean",
            subordinateCount: 0,
            subordinates: [],
          },
        ],
      },
    ];
    mockLoadFacultyHierarchyTree.mockResolvedValue({ nodes: mockNodes });

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/faculty/hierarchy-tree",
      headers: {
        authorization: `Bearer ${adminToken(app)}`,
        host: "demo.localhost",
      },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.payload);
    expect(data.nodes).toHaveLength(1);
    expect(data.nodes[0].id).toBe("f-dean");
    expect(data.nodes[0].subordinates).toHaveLength(1);
    await app.close();
  });

  it("DELETE /api/faculty/:id returns 409 conflict when supervisor has active subordinates without reassignment", async () => {
    mockDeleteFacultyById.mockRejectedValue(
      new SubordinateReassignmentError("Cannot delete faculty member with active subordinates."),
    );

    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/faculty/f-sup",
      headers: {
        authorization: `Bearer ${adminToken(app)}`,
        host: "demo.localhost",
      },
      payload: {
        deletionReason: "Leaving",
      },
    });

    expect(res.statusCode).toBe(409);
    const data = JSON.parse(res.payload);
    expect(data.type).toBe("conflict");
    expect(data.message).toContain("active subordinates");
    await app.close();
  });

  it("DELETE /api/faculty/:id returns 200 when reassignSubordinatesTo is provided", async () => {
    mockDeleteFacultyById.mockResolvedValue(true);

    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/faculty/f-sup",
      headers: {
        authorization: `Bearer ${adminToken(app)}`,
        host: "demo.localhost",
      },
      payload: {
        deletionReason: "Leaving",
        reassignSubordinatesTo: "f-new-sup",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockDeleteFacultyById).toHaveBeenCalledWith(
      "f-sup",
      expect.any(String),
      "Leaving",
      "f-new-sup",
    );
    await app.close();
  });
});
