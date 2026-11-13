import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const getJob = vi.hoisted(() => vi.fn());
vi.mock("../services/backgroundJobWorkerService.js", () => ({
  getUserBackgroundJob: getJob,
}));

const upsert = vi.hoisted(() => vi.fn());
vi.mock("../services/backgroundJobService.js", () => ({
  upsertUserBackgroundJob: upsert,
  dismissUserBackgroundJob: vi.fn(),
  listUserBackgroundJobs: vi.fn(async () => []),
  clearFinishedUserBackgroundJobs: vi.fn(async () => []),
}));

vi.mock("../middleware/authenticate.js", () => ({
  authenticateTenant: async (request: { user?: unknown; tenant?: unknown }) => {
    request.user = { id: "u-1", role: "admin", workspaceSubdomain: "demo" };
    request.tenant = { id: "demo" };
  },
}));

import backgroundJobRoutes from "../routes/common/backgroundJobs.js";

const ownJob = {
  id: "demo:u-1:key",
  moduleId: "examinations",
  kind: "marks-import",
  status: "failed",
  label: "Import",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("background job ownership", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function build() {
    const app = Fastify({ logger: false });
    apps.push(app);
    await app.register(backgroundJobRoutes, { prefix: "/api/background-jobs" });
    return app;
  }

  it("serves only a job the caller owns", async () => {
    getJob.mockResolvedValueOnce(ownJob);
    const app = await build();
    const res = await app.inject({ method: "GET", url: `/api/background-jobs/${ownJob.id}` });
    expect(res.statusCode).toBe(200);
    expect(getJob).toHaveBeenCalledWith("u-1", ownJob.id);
  });

  it("404s another user's job instead of serializing it", async () => {
    getJob.mockResolvedValueOnce(null);
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/api/background-jobs/other-user-job" });
    expect(res.statusCode).toBe(404);
  });

  it("refuses to upsert a job the caller does not own", async () => {
    getJob.mockResolvedValueOnce(null);
    const app = await build();
    const res = await app.inject({
      method: "PUT",
      url: "/api/background-jobs/other-user-job",
      payload: {
        id: "other-user-job",
        moduleId: "examinations",
        kind: "marks-import",
        status: "completed",
        label: "forged",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(404);
    expect(upsert).not.toHaveBeenCalled();
  });
});
