import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { accountantToken, adminToken, auditorToken, teacherToken } from "./helpers/tokens.js";

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
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo"
          ? { id: "ws-demo", subdomain: "demo", madrasaName: "Demo Madrasa", enabled: true }
          : null,
      ),
  };
});

const mockLoadObligationsCommandMetrics = vi.fn();
const mockLoadObligationCollections = vi.fn();
const mockReplaceMujtahidReps = vi.fn();
const mockReplaceWakalaAggregate = vi.fn();

vi.mock("../obligations/use-cases/obligationsUseCases.js", () => ({
  obligationsUseCases: {
    loadObligationTypes: vi.fn().mockResolvedValue([]),
    upsertObligationTypes: vi.fn(),
    loadMujtahids: vi.fn().mockResolvedValue([]),
    upsertMujtahids: vi.fn(),
    loadMujtahidReps: vi.fn().mockResolvedValue([]),
    upsertMujtahidReps: vi.fn(),
    loadWakalaTypes: vi.fn().mockResolvedValue([]),
    upsertWakalaTypes: vi.fn(),
    loadObligationDistributions: vi.fn().mockResolvedValue([]),
    upsertObligationDistributions: vi.fn(),
    loadObligationCollections: (...args: unknown[]) => mockLoadObligationCollections(...args),
    upsertObligationCollections: vi.fn(),
    deleteObligationCollectionById: vi.fn(),
    restoreObligationCollectionById: vi.fn(),
    bulkSoftDeleteObligationCollections: vi.fn(),
    bulkRestoreObligationCollections: vi.fn(),
    loadObligationsCommandMetrics: (...args: unknown[]) =>
      mockLoadObligationsCommandMetrics(...args),
    loadObligationsReportAggregates: vi.fn().mockResolvedValue({}),
    replaceObligationTypes: vi.fn(),
    replaceMujtahids: vi.fn(),
    replaceMujtahidReps: (...args: unknown[]) => mockReplaceMujtahidReps(...args),
    replaceWakalaTypes: vi.fn(),
    replaceObligationDistributions: vi.fn(),
    replaceObligationCollections: vi.fn(),
    replaceWakalaAggregate: (...args: unknown[]) => mockReplaceWakalaAggregate(...args),
    // The contract router calls these instead of opening its own tenant transaction.
    runObligationsRead: async <T>(operation: () => Promise<T>): Promise<T> => operation(),
    loadObligationCollectionVoucher: vi.fn().mockResolvedValue(null),
  },
}));

describe("obligations metrics REST", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadObligationsCommandMetrics.mockReset().mockResolvedValue({
      total: 2,
      totalAmount: 250,
      cash: 1,
      online: 1,
      newThisPeriod: 1,
      obligationTypes: 3,
    });
    mockLoadObligationCollections.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/obligations/metrics loads SQL metrics for authorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      metrics: {
        total: 2,
        totalAmount: 250,
        cash: 1,
        online: 1,
        newThisPeriod: 1,
        obligationTypes: 3,
      },
    });
    expect(mockLoadObligationsCommandMetrics).toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/obligations/metrics returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadObligationsCommandMetrics).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("obligations collections contract REST", () => {
  it("GET /api/obligations/collections allows authorized roles with read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${auditorToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadObligationCollections).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: false }),
    );
    await app.close();
  });

  it("rejects a query key the endpoint does not honour instead of ignoring it", async () => {
    // `baseListQuerySchema` was a passthrough: `?studentId=`/`?overdue=` were accepted and dropped,
    // so a client could filter or paginate and silently receive the whole list (audit R1).
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections?studentId=stu-1",
      headers: { host: "demo.localhost", authorization: `Bearer ${auditorToken(app)}` },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).type).toBe("validation_error");
    expect(mockLoadObligationCollections).not.toHaveBeenCalled();
    await app.close();
  });

  it("forwards limit and offset to the use case", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections?limit=25&offset=50",
      headers: { host: "demo.localhost", authorization: `Bearer ${auditorToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadObligationCollections).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25, offset: 50 }),
    );
    await app.close();
  });

  it("validates the response body against the declared collection schema", async () => {
    // With `responseValidation: true` a handler whose shape drifts from the contract must fail
    // loudly. The other list tests mock `[]`, which would hide exactly that drift.
    const { obligationCollectionRecordSchema } = await import("@mms/shared");
    const record = obligationCollectionRecordSchema.parse({
      id: "oc-1",
      receipt_no: "REC-1",
      received_date: "2026-06-15",
      sender_id: "cnt-1",
      amount: 1500.25,
      currency_id: "PKR",
      payment_mode: "Cash",
      obligation_type_id: "ot-1",
      mujtahid_representative_id: "rep-1",
      received_by: "usr-1",
    });
    mockLoadObligationCollections.mockResolvedValueOnce([record]);

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections",
      headers: { host: "demo.localhost", authorization: `Bearer ${auditorToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(1);
    expect(JSON.parse(res.body)[0].receipt_no).toBe("REC-1");
    await app.close();
  });

  it("fails loudly when a handler body drifts from the declared schema", async () => {
    // Proves response validation is actually installed: without it this drifted record would ship
    // to the client as a 200 (audit R3).
    mockLoadObligationCollections.mockResolvedValueOnce([
      { id: "oc-1", receipt_no: "REC-1", amount: "not-a-number" },
    ]);
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections",
      headers: { host: "demo.localhost", authorization: `Bearer ${auditorToken(app)}` },
    });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).type).toBe("contract_violation");
    await app.close();
  });

  it("no longer answers 503 for the export route: the runner is registered", async () => {
    // The route refuses with 503 when `hasBackgroundJobRunner("obligations:export")` is false, so
    // any other outcome proves the runner is registered in this process. The queue itself may be
    // unavailable in a test environment — that is a different 503 message.
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/obligations/export/csv",
      headers: { host: "demo.localhost", authorization: `Bearer ${auditorToken(app)}` },
      payload: {},
    });
    expect(res.statusCode).not.toBe(200);
    expect(res.body).not.toContain("not available for this module");
    await app.close();
  });

  it("rejects a tasks-shaped import body with 400 before the runner exists", async () => {
    // The blueprint used to be a copy of the tasks document (`title`/`status`/`dueDate`), so this
    // body validated and fell through to the missing-runner 503. It is now the receipt document.
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/obligations/import",
      headers: { host: "demo.localhost", authorization: `Bearer ${accountantToken(app)}` },
      payload: { rows: [{ title: "Khums", status: "Pending", dueDate: "2026-11-01" }] },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).type).toBe("validation_error");
    await app.close();
  });

  it("rejects a malformed report date with 400 rather than a database 500", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/report-aggregates?dateFrom=abc",
      headers: { host: "demo.localhost", authorization: `Bearer ${auditorToken(app)}` },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).type).toBe("validation_error");
    await app.close();
  });

  it("GET /api/obligations/collections?includeDeleted=true returns 403 for roles without delete permissions", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections?includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${auditorToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadObligationCollections).not.toHaveBeenCalled();
    await app.close();
  });

  it("maps a domain rejection to its declared status instead of 500 (audit A3)", async () => {
    const { ValidationError } = await import("../lib/httpErrors.js");
    mockLoadObligationCollections.mockRejectedValueOnce(
      new ValidationError("No wakala is configured", "obligation_wakala_required"),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${auditorToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).type).toBe("validation_error");
    await app.close();
  });

  it("still answers 500 for an unmapped failure", async () => {
    mockLoadObligationCollections.mockRejectedValueOnce(new Error("connection reset"));
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${auditorToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).type).toBe("database_error");
    await app.close();
  });

  it("GET /api/obligations/collections?includeDeleted=true succeeds for admin with delete permissions", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections?includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadObligationCollections).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    await app.close();
  });

  it("GET /api/obligations/collections returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadObligationCollections).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("obligations wakala aggregate REST", () => {
  it("PUT /api/obligations/wakala-aggregate/bulk writes the aggregate for a writer", async () => {
    mockReplaceWakalaAggregate.mockReset().mockResolvedValue({
      wakalaTypes: [],
      distributions: [],
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/obligations/wakala-aggregate/bulk",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { wakalaTypes: [], distributions: [] },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ wakalaTypes: [], distributions: [] });
    expect(mockReplaceWakalaAggregate).toHaveBeenCalledWith({
      wakalaTypes: [],
      distributions: [],
    });
    await app.close();
  });

  it("rejects a read-only role", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/obligations/wakala-aggregate/bulk",
      headers: { host: "demo.localhost", authorization: `Bearer ${auditorToken(app)}` },
      payload: { wakalaTypes: [], distributions: [] },
    });
    expect(res.statusCode).toBe(403);
    expect(mockReplaceWakalaAggregate).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("obligations reps bulk replace REST", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockReplaceMujtahidReps.mockReset();
    mockReplaceMujtahidReps.mockImplementation(async (reps) => reps);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("PUT /api/obligations/reps/bulk invokes replaceMujtahidReps and returns updated reps", async () => {
    const app = await buildApp();
    const payload = [{ id: "mr1", name: "Remaining Rep", mujtahid_id: "m1" }];
    const res = await app.inject({
      method: "PUT",
      url: "/api/obligations/reps/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect(mockReplaceMujtahidReps).toHaveBeenCalledWith(payload);
    expect(res.json()).toEqual({ reps: payload });
    await app.close();
  });

  it("PUT /api/obligations/reps/bulk returns 403 for unauthorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/obligations/reps/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: [],
    });
    expect(res.statusCode).toBe(403);
    expect(mockReplaceMujtahidReps).not.toHaveBeenCalled();
    await app.close();
  });
});
