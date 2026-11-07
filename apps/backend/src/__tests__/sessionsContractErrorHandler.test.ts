import { describe, expect, it } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { installSessionsContractErrorHandler } from "../lib/sessionsContractErrorHandler.js";
import { HttpDomainError } from "../lib/httpErrors.js";
import { ResponseValidationError } from "@ts-rest/core";

class DomainErrorWithViolations extends HttpDomainError {
  readonly violations: string[];
  constructor(statusCode: number, type: string, message: string, violations: string[]) {
    super(statusCode, type, message);
    this.violations = violations;
  }
}

describe("installSessionsContractErrorHandler", () => {
  async function buildTestApp(): Promise<FastifyInstance> {
    const app = fastify();
    installSessionsContractErrorHandler(app);

    app.get("/domain-error", async () => {
      throw new DomainErrorWithViolations(409, "conflict_detected", "Resource conflict", [
        "already_exists",
      ]);
    });

    app.get("/response-validation-error", async () => {
      throw new ResponseValidationError(
        { method: "GET", path: "/test" } as never,
        new ZodError([]),
      );
    });

    app.get("/generic-error", async () => {
      throw new Error("Unexpected crash");
    });

    await app.ready();
    return app;
  }

  it("handles 4xx domain errors with status, type, message, and violations", async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: "GET", url: "/domain-error" });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.type).toBe("conflict_detected");
    expect(body.message).toBe("Resource conflict");
    expect(body.violations).toEqual(["already_exists"]);
  });

  it("handles ResponseValidationError with 500 contract_violation", async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: "GET", url: "/response-validation-error" });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.type).toBe("contract_violation");
    expect(body.message).toContain("contract");
  });

  it("handles generic errors with 500 server_error and hides internal details", async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: "GET", url: "/generic-error" });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.type).toBe("server_error");
    expect(body.message).toBe("Internal server error");
  });
});
