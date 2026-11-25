import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  enforceSessionResponses,
  SessionContractViolationError,
} from "../lib/sessionContractResponses.js";

const contract = {
  get: {
    method: "GET",
    path: "/test",
    responses: {
      200: z.object({ id: z.string(), name: z.string() }),
      404: z.object({
        type: z.string(),
        message: z.string(),
        violations: z.array(z.string()).optional(),
      }),
    },
  },
  create: {
    method: "POST",
    path: "/test",
    responses: { 201: z.object({ id: z.string() }) },
  },
};

function wrapped(handler: (args: never) => Promise<{ status: number; body?: unknown }>) {
  return enforceSessionResponses(contract, { get: handler } as never) as {
    get: (args: never) => Promise<{ status: number; body?: unknown }>;
  };
}

describe("enforceSessionResponses", () => {
  it("strips fields that are not declared on the response schema", async () => {
    const result = await wrapped(async () => ({
      status: 200,
      body: { id: "s1", name: "Year", overlapExempt: true, deletedBy: "u1" },
    })).get(null as never);

    expect(result).toEqual({ status: 200, body: { id: "s1", name: "Year" } });
  });

  it("rejects a success body that does not match the contract", async () => {
    await expect(
      wrapped(async () => ({ status: 200, body: { id: "s1" } })).get(null as never),
    ).rejects.toBeInstanceOf(SessionContractViolationError);
  });

  it("rejects an undeclared success status", async () => {
    await expect(
      wrapped(async () => ({ status: 202, body: { id: "s1" } })).get(null as never),
    ).rejects.toThrow("undeclared status 202");
  });

  it("preserves a declared error body, including violations", async () => {
    const result = await wrapped(async () => ({
      status: 404,
      body: { type: "not_found", message: "Missing", violations: ["gone"] },
    })).get(null as never);

    expect(result.status).toBe(404);
    expect(result.body).toMatchObject({ type: "not_found", violations: ["gone"] });
  });

  it("passes an undeclared error body through (domain errors are not relabelled)", async () => {
    const result = await wrapped(async () => ({
      status: 409,
      body: { type: "conflict", message: "Still referenced" },
    })).get(null as never);

    expect(result).toEqual({
      status: 409,
      body: { type: "conflict", message: "Still referenced" },
    });
  });

  it("does not wrap non-function handler config entries", () => {
    const config = { handler: vi.fn() };
    const result = enforceSessionResponses(contract, { ...config } as never);
    expect(typeof (result as Record<string, unknown>).handler).toBe("function");
  });
});
