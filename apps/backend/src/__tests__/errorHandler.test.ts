import fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerErrorHandlers } from "../lib/errorHandler.js";
import { markRequestDiagnosticStage, startRequestDiagnostics } from "../lib/requestDiagnostics.js";

describe("production error handler", () => {
  const apps: ReturnType<typeof fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("returns a request reference without exposing the underlying error", async () => {
    const app = fastify({
      logger: false,
      genReqId: () => "req-password-reset-1",
    });
    apps.push(app);
    registerErrorHandlers(app, true);
    app.get("/failure", async () => {
      throw new Error("sensitive database detail");
    });

    const response = await app.inject({ method: "GET", url: "/failure" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      type: "server_error",
      message: "Internal server error. Reference: req-password-reset-1",
      requestId: "req-password-reset-1",
    });
    expect(response.body).not.toContain("sensitive database detail");
  });

  it("returns a safe reset-password stage and dependency for pre-handler failures", async () => {
    const app = fastify({
      logger: false,
      genReqId: () => "req-password-reset-2",
    });
    apps.push(app);
    registerErrorHandlers(app, true);
    app.post(
      "/api/users/:id/reset-password",
      {
        onRequest: async (request) => {
          startRequestDiagnostics(request, "users.reset_password");
          markRequestDiagnosticStage(request, "authentication_workspace_lookup");
        },
        preHandler: async () => {
          throw new Error("sensitive database connection detail");
        },
      },
      async () => ({ success: true }),
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/users/u-1/reset-password",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      type: "server_error",
      message:
        "Internal server error during authentication workspace lookup. Reference: req-password-reset-2",
      requestId: "req-password-reset-2",
      operation: "users.reset_password",
      stage: "authentication_workspace_lookup",
      dependency: "database",
    });
    expect(response.body).not.toContain("sensitive database connection detail");
  });
});
