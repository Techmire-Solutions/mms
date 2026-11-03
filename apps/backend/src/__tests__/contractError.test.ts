import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { handleContractError } from "../lib/contractError.js";

type FakeRequest = Parameters<typeof handleContractError>[0];

function fakeRequest() {
  const log = { error: vi.fn() };
  return { request: { url: "/api/students/x", log } as unknown as FakeRequest, log };
}

const fallback = {
  status: 500,
  body: { type: "database_error", message: "Failed to load" },
};

describe("handleContractError", () => {
  it("logs the cause with request context before answering the fallback", () => {
    // ts-rest handlers bypass the Fastify error pipeline, so a bare `catch { return 500 }`
    // makes production failures undiagnosable. This is the single seam that keeps the stack.
    const { request, log } = fakeRequest();
    const error = new Error("connection terminated");

    const result = handleContractError(request, error, fallback);

    expect(log.error).toHaveBeenCalledWith(
      { err: error, url: "/api/students/x" },
      "Failed to load",
    );
    expect(result).toEqual({ status: 500, body: fallback.body });
  });

  it("maps a Zod failure to 400 instead of mislabelling it a database error", () => {
    const { request } = fakeRequest();
    const error = new ZodError([{ code: "custom", path: ["status"], message: "Invalid status" }]);

    const result = handleContractError(request, error, fallback);

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ type: "validation_error" });
  });

  it("preserves an intentional domain status over the caller's fallback", () => {
    const { request } = fakeRequest();
    const error = Object.assign(new Error("Restoring deleted students requires delete"), {
      statusCode: 403,
      type: "forbidden",
    });

    const result = handleContractError(request, error, fallback);

    expect(result.status).toBe(403);
    expect(result.body.type).toBe("forbidden");
  });
});
