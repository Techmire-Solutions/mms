import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, teacherToken, viewerToken } from "./helpers/tokens.js";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
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

const mockList = vi.fn();
const mockListActive = vi.fn();
const mockSave = vi.fn();
const mockRemove = vi.fn();
const mockRestore = vi.fn();

vi.mock("../sessions/use-cases/academicCatalogUseCases.js", () => ({
  ACADEMIC_CATALOG_BROADCAST_KEY: "academic_catalogs",
  academicCatalogUseCases: {
    list: (...args: unknown[]) => mockList(...args),
    listActive: (...args: unknown[]) => mockListActive(...args),
    save: (...args: unknown[]) => mockSave(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    restore: (...args: unknown[]) => mockRestore(...args),
  },
}));

const ITEM = {
  id: "p-1",
  code: "hifz",
  name: "Hifz",
  shortName: null,
  status: "active",
  sortOrder: 0,
  isSystem: true,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function headers(token: string) {
  return { host: "demo.localhost", authorization: `Bearer ${token}` };
}

describe("academic catalog routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("given a teacher, should list programs and given a viewer forbid saving when PUT is sent", async () => {
    // Arrange
    mockList.mockResolvedValueOnce([ITEM]);
    const app = await buildApp();

    // Act
    const list = await app.inject({
      method: "GET",
      url: "/api/sessions/catalogs/programs",
      headers: headers(teacherToken(app)),
    });
    const save = await app.inject({
      method: "PUT",
      url: "/api/sessions/catalogs/programs/p-2",
      headers: headers(viewerToken(app)),
      payload: { name: "Nazra" },
    });

    // Assert
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.body)).toEqual({ items: [ITEM] });
    expect(save.statusCode).toBe(403);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("given an admin, should save with the caller id and reject unknown catalogs and extra keys when PUT is sent", async () => {
    // Arrange
    mockSave.mockResolvedValueOnce(ITEM);
    const app = await buildApp();
    const token = adminToken(app);

    // Act
    const saved = await app.inject({
      method: "PUT",
      url: "/api/sessions/catalogs/programs/p-1",
      headers: headers(token),
      payload: { name: "Hifz" },
    });
    const unknown = await app.inject({
      method: "PUT",
      url: "/api/sessions/catalogs/grades/p-1",
      headers: headers(token),
      payload: { name: "Hifz" },
    });
    const extra = await app.inject({
      method: "PUT",
      url: "/api/sessions/catalogs/programs/p-1",
      headers: headers(token),
      payload: { name: "Hifz", colour: "red" },
    });

    // Assert
    expect(saved.statusCode).toBe(200);
    expect(mockSave).toHaveBeenCalledWith(
      "demo",
      "programs",
      "p-1",
      { name: "Hifz", code: null, shortName: null, status: "active" },
      expect.any(String),
    );
    expect(unknown.statusCode).toBe(400);
    expect(extra.statusCode).toBe(400);
  });

  it("given a teacher, should read active subjects through the examinations module when listed", async () => {
    // Arrange
    mockListActive.mockResolvedValueOnce([ITEM]);
    const app = await buildApp();

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/api/examinations/subjects",
      headers: headers(teacherToken(app)),
    });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(mockListActive).toHaveBeenCalledWith("demo", "subjects");
  });
});
