import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, viewerToken } from "./helpers/tokens.js";

const repository = vi.hoisted(() => ({
  saveFacultyAssignment: vi.fn(),
  softDeleteFacultyAssignment: vi.fn(),
  findFacultyAssignmentById: vi.fn(),
  listFacultyAssignments: vi.fn(),
  closeAssignment: vi.fn(),
}));
vi.mock("../db/database.js", () => ({
  initDb: vi.fn(),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));
vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn(),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));
vi.mock("../db/repositories/facultyAssignmentRepository.js", () => repository);
vi.mock("../services/workspaceService.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/workspaceService.js")>()),
  getWorkspaceBySubdomain: vi.fn(async (sub: string) =>
    sub === "demo"
      ? {
          id: "ws-demo",
          subdomain: "demo",
          madrasaName: "Demo",
          createdAt: "2026-01-01",
          enabled: true,
        }
      : null,
  ),
}));

let app: Awaited<ReturnType<typeof buildApp>>;
const url = "/api/faculty/f/assignments/a";
const payload = {
  facultyId: "f",
  departmentId: "d",
  designationId: "g",
  startDate: "2024-01-01",
  isPrimary: true,
};
beforeEach(async () => {
  vi.clearAllMocks();
  repository.findFacultyAssignmentById.mockResolvedValue({ ...payload, id: "a", deletedAt: null });
  app = await buildApp();
});
afterEach(async () => {
  await app.close();
});
const headers = (token: string) => ({ host: "demo.localhost", authorization: `Bearer ${token}` });

describe("Faculty assignment contract and authorization", () => {
  it("allows an administrator to save through the actual contract router", async () => {
    const response = await app.inject({
      method: "PUT",
      url,
      payload,
      headers: headers(adminToken(app)),
    });
    expect(response.statusCode).toBe(200);
    expect(repository.saveFacultyAssignment).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ id: "a", facultyId: "f", updatedBy: "u-admin" }),
    );
  });

  it("denies viewer mutation and unauthenticated requests before repository writes", async () => {
    const denied = await app.inject({
      method: "PUT",
      url,
      payload,
      headers: headers(viewerToken(app)),
    });
    expect(denied.statusCode).toBe(403);
    const unauthenticated = await app.inject({
      method: "PUT",
      url,
      payload,
      headers: { host: "demo.localhost" },
    });
    expect(unauthenticated.statusCode).toBe(401);
    expect(repository.saveFacultyAssignment).not.toHaveBeenCalled();
  });

  it("rejects impossible dates and client-supplied tenant fields", async () => {
    for (const invalid of [
      { ...payload, startDate: "2024-02-30" },
      { ...payload, workspaceSubdomain: "other" },
    ]) {
      const response = await app.inject({
        method: "PUT",
        url,
        payload: invalid,
        headers: headers(adminToken(app)),
      });
      expect(response.statusCode).toBe(400);
    }
    expect(repository.saveFacultyAssignment).not.toHaveBeenCalled();
  });

  it("allows admin deletion and denies viewer deletion", async () => {
    const denied = await app.inject({ method: "DELETE", url, headers: headers(viewerToken(app)) });
    expect(denied.statusCode).toBe(403);
    expect(repository.softDeleteFacultyAssignment).not.toHaveBeenCalled();
    const allowed = await app.inject({ method: "DELETE", url, headers: headers(adminToken(app)) });
    expect(allowed.statusCode).toBe(200);
    expect(repository.softDeleteFacultyAssignment).toHaveBeenCalledWith(
      "demo",
      "a",
      "u-admin",
      "User deleted",
    );
  });
});
