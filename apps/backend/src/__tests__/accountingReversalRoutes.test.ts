import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { accountantToken, auditorToken, guardianToken } from "./helpers/tokens.js";

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

const mockReverse = vi.fn();

vi.mock("../accounting/use-cases/reverseJournalEntryUseCase.js", () => ({
  reverseJournalEntry: (...args: unknown[]) => mockReverse(...args),
}));

type Role = "accountant" | "auditor" | "guardian";

async function reverse(role: Role | undefined, payload: Record<string, unknown>) {
  const app = await buildApp();
  const token =
    role === "accountant"
      ? accountantToken(app)
      : role === "auditor"
        ? auditorToken(app)
        : role === "guardian"
          ? guardianToken(app)
          : undefined;
  const res = await app.inject({
    method: "POST",
    url: "/api/accounting/entries/je-orig/reverse",
    headers: { host: "demo.localhost", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    payload,
  });
  await app.close();
  return res;
}

const VALID = { date: "2026-10-08", reason: "Posted to the wrong account" };

describe("POST /api/accounting/entries/:id/reverse", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockReverse.mockReset().mockResolvedValue({
      entry: { id: "je-rev", ref: "REV-JV-1" },
      original: { id: "je-orig", ref: "JV-1", date: "2026-09-15" },
      priorPeriod: false,
      executedAt: "2026-10-08T09:30:00.000Z",
    });
  });

  it("given no session, should return 401 without reversing", async () => {
    // Arrange / Act
    const res = await reverse(undefined, VALID);

    // Assert
    expect(res.statusCode).toBe(401);
    expect(mockReverse).not.toHaveBeenCalled();
  });

  it("given a role without accounting write permission, should return 403 without reversing", async () => {
    // Arrange / Act
    const guardian = await reverse("guardian", VALID);
    const auditor = await reverse("auditor", VALID);

    // Assert
    expect(guardian.statusCode).toBe(403);
    expect(auditor.statusCode).toBe(403);
    expect(mockReverse).not.toHaveBeenCalled();
  });

  it("given a missing or blank reason, should reject the request without reversing", async () => {
    // Arrange / Act
    const missing = await reverse("accountant", { date: "2026-10-08" });
    const blank = await reverse("accountant", { date: "2026-10-08", reason: "   " });

    // Assert
    expect(missing.statusCode).toBe(400);
    expect(blank.statusCode).toBe(400);
    expect(mockReverse).not.toHaveBeenCalled();
  });

  it("given an unknown field such as deleteOriginal, should reject the request", async () => {
    // Arrange / Act
    const res = await reverse("accountant", { ...VALID, deleteOriginal: true });

    // Assert
    expect(res.statusCode).toBe(400);
    expect(mockReverse).not.toHaveBeenCalled();
  });

  it("given a valid request, should reverse as the session user and return 201", async () => {
    // Arrange / Act
    const res = await reverse("accountant", VALID);

    // Assert
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      entry: { id: "je-rev" },
      executedAt: "2026-10-08T09:30:00.000Z",
    });
    expect(mockReverse).toHaveBeenCalledWith(
      "demo",
      "je-orig",
      VALID,
      expect.objectContaining({ id: expect.any(String) }),
      expect.objectContaining({ transaction: expect.any(Function) }),
    );
  });

  it("given a domain conflict, should surface it as a 409 envelope", async () => {
    // Arrange
    mockReverse.mockRejectedValue(
      Object.assign(new Error("Journal JV-1 is already reversed by REV-JV-1"), { statusCode: 409 }),
    );

    // Act
    const res = await reverse("accountant", VALID);

    // Assert
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      type: "conflict",
      message: "Journal JV-1 is already reversed by REV-JV-1",
    });
  });
});
