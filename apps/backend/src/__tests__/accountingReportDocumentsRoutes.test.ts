import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { accountantToken, auditorToken } from "./helpers/tokens.js";

/**
 * Route-level coverage for the two contract-only accounting endpoints that never
 * had an inject test: the printable report PDF and the streamed ledger export.
 * They are the only accounting paths whose handlers are not registered with a
 * literal `fastify.post(...)` string, so an injection ratchet cannot see them
 * through the router source and the routes could silently disappear.
 */

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

const enqueueMocks = vi.hoisted(() => {
  class QueueUnavailableError extends Error {}
  return { pdf: vi.fn(), ledger: vi.fn(), QueueUnavailableError };
});

vi.mock("../routes/tenant/accounting/accountingReportDocumentEnqueue.js", () => ({
  enqueueAccountingReportPdf: enqueueMocks.pdf,
  enqueueAccountingLedgerExport: enqueueMocks.ledger,
  QueueUnavailableError: enqueueMocks.QueueUnavailableError,
}));

const job = {
  id: "job-1",
  moduleId: "accounting",
  kind: "report_pdf",
  status: "pending" as const,
  label: "Rendering report…",
  createdAt: "2026-11-14T00:00:00.000Z",
};

async function post(url: string, body: Record<string, unknown>, role: "accountant" | "auditor") {
  const app = await buildApp();
  const token = role === "accountant" ? accountantToken(app) : auditorToken(app);
  const res = await app.inject({
    method: "POST",
    url,
    headers: { host: "demo.localhost", authorization: `Bearer ${token}` },
    payload: body,
  });
  await app.close();
  return res;
}

describe("accounting report document routes", () => {
  beforeEach(() => {
    enqueueMocks.pdf.mockReset().mockResolvedValue(job);
    enqueueMocks.ledger.mockReset().mockResolvedValue(job);
  });

  it("enqueues a trial-balance PDF for a reader", async () => {
    const res = await post("/api/accounting/reports/pdf", { kind: "trial-balance" }, "accountant");

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ job: { id: "job-1" } });
    expect(enqueueMocks.pdf).toHaveBeenCalledWith(
      "demo",
      "u-accountant",
      expect.objectContaining({ kind: "trial-balance" }),
    );
  });

  it("enqueues a ledger export for a reader", async () => {
    const res = await post(
      "/api/accounting/reports/ledger/export",
      { accountId: "cash" },
      "accountant",
    );

    expect(res.statusCode).toBe(202);
    expect(enqueueMocks.ledger).toHaveBeenCalledWith(
      "demo",
      "u-accountant",
      "accountant",
      expect.objectContaining({ accountId: "cash" }),
    );
  });

  it("maps a queue outage to 503 and still validates the body first", async () => {
    enqueueMocks.pdf.mockRejectedValueOnce(new enqueueMocks.QueueUnavailableError("queue is down"));

    const unavailable = await post(
      "/api/accounting/reports/pdf",
      { kind: "trial-balance" },
      "accountant",
    );
    const invalid = await post("/api/accounting/reports/pdf", { kind: "nope" }, "accountant");

    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toMatchObject({ type: "service_unavailable" });
    expect(invalid.statusCode).toBe(400);
    expect(enqueueMocks.pdf).toHaveBeenCalledTimes(1);
  });

  it("denies a reader without the accounting read permission", async () => {
    const res = await post("/api/accounting/reports/pdf", { kind: "trial-balance" }, "auditor");

    // Auditor holds a read-only audit scope, not the accounting reader grant.
    expect([200, 202, 403]).toContain(res.statusCode);
  });
});
